class LinkedInChatbot {
  constructor() {
    this.profileData = {};
    this.isActive = false;
    this.chatHistory = [];
    this.userPersonality = null;
    this.profileUrl = '';
    this.init();
  }

  async init() {
    // Wait for page to load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.start());
    } else {
      this.start();
    }
  }

  async start() {
    // Check if we're on a LinkedIn profile page
    if (!this.isLinkedInProfile()) return;

    // Test background script connection
    this.testBackgroundConnection();

    // Load user's personality data
    await this.loadUserPersonality();

    // Wait for LinkedIn to load content, then scrape profile data
    await this.scrapeProfileWithRetry();

    // Inject chatbot interface
    this.injectChatbot();

    // Load chat history for this profile
    await this.loadChatHistory();

    // Set up observers for dynamic content
    this.setupObservers();
  }

  async scrapeProfileWithRetry() {
    let attempts = 0;
    const maxAttempts = 5;
    while (attempts < maxAttempts) {
      this.scrapeProfile();
      
      // If we got a real name (not "LinkedIn User"), we're done
      if (this.profileData.name && this.profileData.name !== 'LinkedIn User') {
        console.log(`✅ Successfully scraped profile on attempt ${attempts + 1}`);
        break;
      }
      
      attempts++;
      console.log(`🔄 Attempt ${attempts}/${maxAttempts} - waiting for LinkedIn to load...`);
      
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      }
    }
    
    if (this.profileData.name === 'LinkedIn User') {
      console.log('⚠️ Could not scrape profile name after 5 attempts');
    }
  }

  testBackgroundConnection() {
    try {
      chrome.runtime.sendMessage({ action: 'ping' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('🔴 Background script connection failed:', chrome.runtime.lastError.message);
        } else {
          console.log('🟢 Background script connection successful');
        }
      });
    } catch (error) {
      console.error('🔴 Error testing background connection:', error);
    }
  }

  isLinkedInProfile() {
    return window.location.pathname.startsWith('/in/') && 
           window.location.hostname === 'www.linkedin.com';
  }

  async loadUserPersonality() {
    try {
      const result = await chrome.storage.local.get(['userPersonality', 'cerebrumApiKey']);
      this.userPersonality = result.userPersonality || {
        name: 'User',
        bio: 'I am a professional looking to connect.',
        responseStyle: 'friendly',
        commonResponses: {}
      };
      this.apiKey = result.cerebrumApiKey || null;
      
      // Debug logging
      console.log('Loaded user personality:', this.userPersonality);
      console.log('Loaded API key exists:', !!this.apiKey);
      console.log('API key length:', this.apiKey ? this.apiKey.length : 0);
      
    } catch (error) {
      console.error('Error loading user personality:', error);
    }
  }

  checkProfileMatch() {
    // Check if this profile matches the user's custom setup
    if (this.userPersonality && this.profileData && this.profileData.name) {
      const profileNameLower = this.profileData.name.toLowerCase().trim();
      const personalityNameLower = this.userPersonality.name ? this.userPersonality.name.toLowerCase().trim() : '';
      
      // More strict matching to prevent false positives
      // Only match if names are identical or very similar (allowing for minor variations)
      const isExactMatch = profileNameLower === personalityNameLower;
      const isCloseMatch = personalityNameLower.length > 3 && profileNameLower.length > 3 && 
                          (profileNameLower.includes(personalityNameLower) || personalityNameLower.includes(profileNameLower)) &&
                          Math.abs(profileNameLower.length - personalityNameLower.length) <= 10; // Allow reasonable length difference
      
      // Also check if it's the same person by comparing multiple name parts
      const profileParts = profileNameLower.split(/\s+/).filter(part => part.length > 1);
      const personalityParts = personalityNameLower.split(/\s+/).filter(part => part.length > 1);
      const matchingParts = profileParts.filter(part => personalityParts.includes(part));
      const isMultiPartMatch = matchingParts.length >= 2 && matchingParts.length === Math.min(profileParts.length, personalityParts.length);
      
      this.isOwnProfile = isExactMatch || (isCloseMatch && isMultiPartMatch);
      
      console.log(`🔍 Profile match check: "${profileNameLower}" vs "${personalityNameLower}"`);
      console.log(`   - Exact match: ${isExactMatch}`);
      console.log(`   - Close match: ${isCloseMatch}`);
      console.log(`   - Multi-part match: ${isMultiPartMatch} (${matchingParts.length}/${Math.min(profileParts.length, personalityParts.length)} parts)`);
      console.log(`   - Final result: ${this.isOwnProfile}`);
      
      if (this.isOwnProfile) {
        console.log('✅ This is the user\'s own profile - merging custom setup with scraped data');
        this.mergeCustomAndScrapedData();
      } else {
        console.log('ℹ️ This is not the user\'s profile - using scraped data with intelligent inference');
        // Ensure no custom personality data is attached to other profiles
        this.profileData.customPersonality = null;
      }
    } else {
      this.isOwnProfile = false;
    }
  }

  mergeCustomAndScrapedData() {
    console.log('🔗 Merging custom personality data with scraped LinkedIn data...');
    
    // Store original scraped data for reference
    const scrapedData = { ...this.profileData };
    
    // 1. Use custom bio if available, otherwise keep scraped about
    if (this.userPersonality.bio && this.userPersonality.bio.trim()) {
      console.log('📝 Using custom bio instead of scraped about section');
      this.profileData.about = this.userPersonality.bio;
    } else if (scrapedData.about) {
      console.log('📝 Using scraped about section (no custom bio provided)');
    }
    
    // 2. Always keep scraped experience and education (this is valuable real-time data)
    console.log('💼 Keeping scraped experience and education data');
    console.log(`   Experience: ${scrapedData.experience.length} items`);
    console.log(`   Education: ${scrapedData.education.length} items`);
    
    // 3. Keep scraped skills and website (might be more up-to-date)
    console.log('🛠️ Keeping scraped skills and website data');
    console.log(`   Skills: ${scrapedData.skills.length} items`);
    console.log(`   Website: ${scrapedData.website ? 'Found' : 'Not found'}`);
    
    // 4. Create enhanced profile data object with both sources
    this.profileData.customPersonality = {
      hasCustomBio: !!(this.userPersonality.bio && this.userPersonality.bio.trim()),
      responseStyle: this.userPersonality.responseStyle || 'friendly',
      commonResponses: this.userPersonality.commonResponses || {},
      customResponses: this.userPersonality.customResponses || []
    };
    
    console.log('✅ Successfully merged custom and scraped data:');
    console.log(`   - Bio: ${this.profileData.customPersonality.hasCustomBio ? 'Custom' : 'Scraped'}`);
    console.log(`   - Experience: Scraped (${this.profileData.experience.length} items)`);
    console.log(`   - Education: Scraped (${this.profileData.education.length} items)`);
    console.log(`   - Skills: Scraped (${this.profileData.skills.length} items)`);
    console.log(`   - Custom Responses: ${this.profileData.customPersonality.customResponses.length} items`);
    console.log(`   - Response Style: ${this.profileData.customPersonality.responseStyle}`);
  }

  scrapeProfile() {
    try {
      // Get profile name - updated selectors for current LinkedIn
      const nameElement = document.querySelector('h1.text-heading-xlarge.inline.t-24.v-align-middle.break-words') || 
                         document.querySelector('h1[data-anonymize="person-name"]') ||
                         document.querySelector('.pv-text-details__left-panel h1') ||
                         document.querySelector('h1.text-heading-xlarge') ||
                         document.querySelector('.profile-photo-edit__preview h1') ||
                         document.querySelector('h1');
      
      console.log('🔍 Name element found:', !!nameElement);
      if (nameElement) {
        console.log('📝 Name element text:', nameElement.textContent?.trim());
        console.log('🏷️ Name element class:', nameElement.className);
      }
      
      // Get headline
      const headlineElement = document.querySelector('.text-body-medium.break-words') ||
                             document.querySelector('[data-anonymize="headline"]') ||
                             document.querySelector('.pv-text-details__left-panel .text-body-medium') ||
                             document.querySelector('.text-body-medium');
      
      console.log('🔍 Headline element found:', !!headlineElement);
      if (headlineElement) {
        console.log('📝 Headline text:', headlineElement.textContent?.trim());
      }
      
      // Get about section
      const aboutElement = document.querySelector('#about') ||
                          document.querySelector('[data-test-id="about-section"]');
      let aboutText = '';
      if (aboutElement) {
        const aboutContent = aboutElement.parentElement?.querySelector('.display-flex.full-width') ||
                           aboutElement.nextElementSibling;
        aboutText = aboutContent?.textContent?.trim() || '';
      }

      // Get experience with LinkedIn-specific selectors
      console.log('🔍 Looking for experience section...');
      const experienceSection = document.querySelector('#experience');
      
      let experience = [];
      console.log('📝 Experience section found:', !!experienceSection);
      
      if (experienceSection) {
        // Find the experience container - look for the artdeco card containing the experience list
        const experienceContainer = experienceSection.closest('section') || 
                                   experienceSection.parentElement?.querySelector('section') ||
                                   document.querySelector('section.artdeco-card.pv-profile-card');
        
        console.log('📝 Experience container found:', !!experienceContainer);
        
        if (experienceContainer) {
          // Find experience list items - LinkedIn uses specific classes
          const experienceItems = experienceContainer.querySelectorAll('li.artdeco-list__item');
          console.log(`📊 Found ${experienceItems.length} experience items`);
          
                               experience = Array.from(experienceItems).slice(0, 6).map((item, index) => {
            console.log(`🔍 Processing experience item ${index + 1}:`);
            
            // Enhanced LinkedIn-specific selectors for job title
            let title = '';
            const titleSelectors = [
              // Primary selectors for job titles
              '.display-flex.align-items-center.mr1.hoverable-link-text.t-bold span[aria-hidden="true"]',
              '.mr1.hoverable-link-text.t-bold span[aria-hidden="true"]',
              '.hoverable-link-text.t-bold span[aria-hidden="true"]',
              '.t-bold span[aria-hidden="true"]',
              // Backup selectors
              '.mr1.hoverable-link-text span[aria-hidden="true"]',
              'span[aria-hidden="true"]'
            ];
            
            // Try each selector until we find a valid title
            for (const selector of titleSelectors) {
              const elements = item.querySelectorAll(selector);
              for (const element of elements) {
                const text = element.textContent?.trim() || '';
                // Check if this looks like a job title (not a date, company info, etc.)
                if (text && text.length > 2 && text.length < 200 && 
                    !text.includes('·') && !text.includes('mo') && !text.includes('yr') && 
                    !text.includes('Present') && !text.includes('-') && 
                    !text.match(/^\d{4}$/) && !text.match(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/)) {
                  title = text;
                  console.log(`  ✅ Found title with "${selector}": "${title}"`);
                  break;
                }
              }
              if (title) break;
            }
            
            // Enhanced LinkedIn-specific selectors for company name
            let company = '';
            
            // Look for company in spans that come after the title
            const allSpans = item.querySelectorAll('span[aria-hidden="true"]');
            let foundTitle = false;
            
            for (const span of allSpans) {
              const text = span.textContent?.trim() || '';
              
              // Skip the title span
              if (text === title) {
                foundTitle = true;
                continue;
              }
              
              // Look for company name in spans that come after title
              if (foundTitle && text && text.length > 1 && text.length < 100) {
                // Company name patterns - usually contains company info
                if (text.includes('·')) {
                  // Format like "LinkedIn · Full-time"
                  const parts = text.split('·');
                  if (parts.length > 0 && parts[0].trim().length > 1) {
                    company = parts[0].trim();
                    console.log(`  ✅ Found company (with ·): "${company}"`);
                    break;
                  }
                } else if (!text.includes('mo') && !text.includes('yr') && 
                          !text.includes('Present') && !text.includes('-') &&
                          !text.match(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/) &&
                          !text.match(/^\d{1,2}\s/) && !text.match(/\d{4}/) &&
                          !text.toLowerCase().includes('on-site') && !text.toLowerCase().includes('remote') &&
                          !text.toLowerCase().includes('hybrid') && !text.toLowerCase().includes('full-time') &&
                          !text.toLowerCase().includes('part-time') && !text.toLowerCase().includes('contract')) {
                  // Standalone company name
                  company = text;
                  console.log(`  ✅ Found company (standalone): "${company}"`);
                  break;
                }
              }
            }
             
             // Special case: Check if the title IS the company (like "Ahold Delhaize USA")
             if (title && !company) {
               const knownCompanies = ['HubSpot', 'Ahold Delhaize', 'FleishmanHillard', 'Costello Real Estate', 'Amazon', 'Google', 'Meta', 'Instagram'];
               const titleIsCompany = knownCompanies.some(comp => title.includes(comp));
               
               if (titleIsCompany) {
                 console.log(`  🔄 Title appears to be company name: "${title}"`);
                 // Look for sub-roles in the experience
                 const subRoles = item.querySelectorAll('.PSDxkilFUaKvdfKIYDSOqscnGLMYCWgQ .mr1.hoverable-link-text.t-bold span[aria-hidden="true"]');
                 if (subRoles.length > 0) {
                   const subRole = subRoles[0].textContent?.trim();
                   if (subRole) {
                     company = title;
                     title = subRole;
                     console.log(`  🔄 Reassigned - Title: "${title}", Company: "${company}"`);
                   }
                 }
               }
             }
             
                           // Enhanced fallback extraction with better text parsing
              if (!title || !company) {
                console.log(`  🔍 Using enhanced fallback extraction...`);
                
                // Clean the HTML and extract text more intelligently
                const htmlContent = item.innerHTML;
                
                // Remove HTML comments and normalize whitespace
                const cleanedHtml = htmlContent.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ');
                
                // Extract all aria-hidden spans (LinkedIn's main content)
                const ariaSpans = item.querySelectorAll('[aria-hidden="true"]');
                const spanTexts = Array.from(ariaSpans)
                  .map(span => span.textContent?.trim())
                  .filter(text => text && text.length > 1 && text.length < 200);
                
                console.log(`  📝 Found ${spanTexts.length} aria-hidden spans:`, spanTexts.slice(0, 10));
                
                // Smart title extraction - look for first meaningful text that looks like a job title
                if (!title) {
                  for (const text of spanTexts) {
                    // Skip dates, locations, and metadata
                    if (text.includes('·') || text.includes('mo') || text.includes('yr') || 
                        text.includes('Present') || text.includes('-') ||
                        text.match(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/) ||
                        text.match(/^\d{4}$/) || text.match(/\d{1,2}\s+mos?/) ||
                        text.toLowerCase().includes('full-time') || text.toLowerCase().includes('part-time') ||
                        text.toLowerCase().includes('on-site') || text.toLowerCase().includes('remote') ||
                        text.toLowerCase().includes('hybrid') || text.toLowerCase().includes('contract')) {
                      continue;
                    }
                    
                    // Check if this looks like a job title
                    const jobTitleKeywords = [
                      'engineer', 'scientist', 'analyst', 'manager', 'director', 'lead', 'senior', 'principal',
                      'staff', 'intern', 'fellow', 'consultant', 'specialist', 'coordinator', 'associate',
                      'developer', 'designer', 'recruiter', 'founder', 'co-founder', 'president', 'ceo', 'cto',
                      'vice president', 'vp', 'head of', 'research', 'assistant'
                    ];
                    
                    if (jobTitleKeywords.some(keyword => text.toLowerCase().includes(keyword)) ||
                        text.match(/^[A-Z][a-z].*[a-z]$/) && text.length > 8 && text.length < 80) {
                      title = text;
                      console.log(`  🔄 Smart title extraction: "${title}"`);
                      break;
                    }
                  }
                }
                
                // Smart company extraction - look for text after title or known company names
                if (!company) {
                  const knownCompanies = [
                    'LinkedIn', 'Google', 'Meta', 'Instagram', 'Facebook', 'Microsoft', 'Apple', 'Amazon',
                    'Netflix', 'Uber', 'Twitter', 'Snapchat', 'TikTok', 'Spotify', 'Dropbox', 'Zoom',
                    'Slack', 'Salesforce', 'Oracle', 'Adobe', 'Nvidia', 'Intel', 'IBM', 'Cisco', 'VMware',
                    'Tesla', 'Airbnb', 'Stripe', 'Shopify', 'PayPal', 'eBay', 'Yahoo', 'HP', 'Dell', 'SAP',
                    'Accenture', 'Deloitte', 'McKinsey', 'BCG', 'Bain', 'Goldman Sachs', 'Morgan Stanley',
                    'JPMorgan', 'HubSpot', 'Johnson', 'Georgia Institute of Technology', 'New Jersey Governor'
                  ];
                  
                  for (const text of spanTexts) {
                    // Check for known companies
                    const foundCompany = knownCompanies.find(comp => 
                      text.toLowerCase().includes(comp.toLowerCase())
                    );
                    
                    if (foundCompany) {
                      company = text.includes('·') ? text.split('·')[0].trim() : text;
                      console.log(`  🔄 Known company found: "${company}"`);
                      break;
                    }
                    
                    // Look for company patterns (avoiding dates and job types)
                    if (!text.includes('mo') && !text.includes('yr') && !text.includes('Present') &&
                        !text.includes('-') && !text.match(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/) &&
                        !text.toLowerCase().includes('full-time') && !text.toLowerCase().includes('part-time') &&
                        !text.toLowerCase().includes('contract') && !text.toLowerCase().includes('internship') &&
                        text.length > 3 && text.length < 100) {
                      
                      // Check if it contains company suffixes or looks like a company
                      if (text.match(/\b(Inc|LLC|Corp|Company|Ltd|Group|Technologies|Systems|Solutions|University|College|Institute|School)\b/i) ||
                          (text.includes('·') && !text.includes(title))) {
                        company = text.includes('·') ? text.split('·')[0].trim() : text;
                        console.log(`  🔄 Pattern company found: "${company}"`);
                        break;
                      }
                    }
                  }
                }
                
                // Final fallback - try regex patterns on cleaned text
                if (!title || !company) {
                  const allText = spanTexts.join(' ');
                  console.log(`  🔍 Final fallback on combined text: ${allText.substring(0, 200)}...`);
                  
                  // Enhanced job title patterns
                  const jobTitlePatterns = [
                    /\b(Software Engineer|Data Scientist|Product Manager|Engineering Manager|Technical Lead|Senior Engineer|Staff Engineer|Principal Engineer|Research Assistant|Undergraduate Research Assistant)\b/i,
                    /\b(Intern|Fellow|Consultant|Analyst|Developer|Designer|Recruiter|Specialist|Coordinator|Associate|Director|VP|Vice President|President|CEO|CTO|Founder|Co-Founder)\b/i
                  ];
                  
                  if (!title) {
                    for (const pattern of jobTitlePatterns) {
                      const match = allText.match(pattern);
                      if (match) {
                        title = match[0];
                        console.log(`  🔄 Regex title found: "${title}"`);
                        break;
                      }
                    }
                  }
                }
              }
             
             // Build result with better logic
             if (title && company) {
               // Avoid redundancy (e.g., "HubSpot at HubSpot")
               if (title.toLowerCase().includes(company.toLowerCase()) || 
                   company.toLowerCase().includes(title.toLowerCase())) {
                 const result = company.length > title.length ? `Work at ${company}` : title;
                 console.log(`  ✅ Merged result (avoiding redundancy): "${result}"`);
                 return result;
               } else {
                 const result = `${title} at ${company}`;
                 console.log(`  ✅ Final result: "${result}"`);
                 return result;
               }
             } else if (title) {
               console.log(`  ⚠️ Only title found: "${title}"`);
               return title;
             } else if (company) {
               console.log(`  ⚠️ Only company found: "${company}"`);
               return `Work at ${company}`;
             }
             
             console.log(`  ❌ No data extracted from item ${index + 1}`);
             console.log(`  📝 Item HTML preview: ${item.innerHTML.substring(0, 300)}...`);
             return '';
           }).filter(exp => exp && exp.length > 2);
          
          console.log('📝 Final extracted experience:', experience);
        }
      }

      // Get education with LinkedIn-specific selectors
      console.log('🔍 Looking for education section...');
      const educationSection = document.querySelector('#education');
      
      let education = [];
      console.log('📝 Education section found:', !!educationSection);
      
      if (educationSection) {
        // Find the education container
        const educationContainer = educationSection.closest('section') || 
                                  educationSection.parentElement?.querySelector('section') ||
                                  Array.from(document.querySelectorAll('section.artdeco-card.pv-profile-card'))
                                    .find(s => s.querySelector('h2')?.textContent?.toLowerCase().includes('education'));
        
        console.log('📝 Education container found:', !!educationContainer);
        
        if (educationContainer) {
          // Find education list items
          const educationItems = educationContainer.querySelectorAll('li.artdeco-list__item');
          console.log(`📊 Found ${educationItems.length} education items`);
          
          education = Array.from(educationItems).slice(0, 4).map((item, index) => {
            console.log(`🔍 Processing education item ${index + 1}:`);
            
            // Enhanced LinkedIn-specific selectors for school name
            let school = '';
            const schoolSelectors = [
              '.display-flex.align-items-center.mr1.hoverable-link-text.t-bold span[aria-hidden="true"]',
              '.mr1.hoverable-link-text.t-bold span[aria-hidden="true"]',
              '.hoverable-link-text.t-bold span[aria-hidden="true"]',
              '.t-bold span[aria-hidden="true"]'
            ];
            
            // Try each selector to find school name
            for (const selector of schoolSelectors) {
              const elements = item.querySelectorAll(selector);
              for (const element of elements) {
                const text = element.textContent?.trim() || '';
                // Check if this looks like a school name
                if (text && text.length > 2 && text.length < 200 && 
                    (text.includes('University') || text.includes('College') || text.includes('School') ||
                     text.includes('Institute') || text.includes('Academy') ||
                     text.match(/^[A-Z][a-zA-Z\s&,.-]+$/))) {
                  school = text;
                  console.log(`  ✅ Found school with "${selector}": "${school}"`);
                  break;
                }
              }
              if (school) break;
            }
            
            // Enhanced LinkedIn-specific selectors for degree/field
            let degree = '';
            
            // Look for degree in spans that come after the school
            const allSpans = item.querySelectorAll('span[aria-hidden="true"]');
            let foundSchool = false;
            
            for (const span of allSpans) {
              const text = span.textContent?.trim() || '';
              
              // Skip the school span
              if (text === school) {
                foundSchool = true;
                continue;
              }
              
              // Look for degree in spans that come after school
              if (foundSchool && text && text.length > 2 && text.length < 150) {
                // Skip dates, locations, and metadata
                if (!text.includes('·') && !text.includes('-') && !text.includes('Present') &&
                    !text.match(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/) &&
                    !text.match(/^\d{4}$/) && !text.match(/\d{1,2}\s+mos?/) &&
                    !text.toLowerCase().includes('activity') && 
                    !text.toLowerCase().includes('see all') &&
                    text !== school) {
                  degree = text;
                  console.log(`  ✅ Found degree: "${degree}"`);
                  break;
                }
              }
            }
            
            // Enhanced fallback text extraction for education
            if (!school && !degree) {
              console.log(`  🔍 Using enhanced education fallback extraction...`);
              
              // Extract all aria-hidden spans (LinkedIn's main content)
              const ariaSpans = item.querySelectorAll('[aria-hidden="true"]');
              const spanTexts = Array.from(ariaSpans)
                .map(span => span.textContent?.trim())
                .filter(text => text && text.length > 1 && text.length < 200);
              
              console.log(`  📝 Found ${spanTexts.length} education spans:`, spanTexts.slice(0, 8));
              
              // Smart school extraction
              if (!school) {
                for (const text of spanTexts) {
                  // Skip dates, locations, and metadata
                  if (text.includes('·') || text.includes('-') || text.includes('Present') ||
                      text.match(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/) ||
                      text.match(/^\d{4}$/) || text.match(/\d{1,2}\s+mos?/) ||
                      text.toLowerCase().includes('activity') || text.toLowerCase().includes('see all')) {
                    continue;
                  }
                  
                  // Check if this looks like a school name
                  if (text.includes('University') || text.includes('College') || text.includes('School') ||
                      text.includes('Institute') || text.includes('Academy') || text.includes('Technology') ||
                      (text.match(/^[A-Z][a-zA-Z\s&,.-]+$/) && text.length > 8 && text.length < 100)) {
                    school = text;
                    console.log(`  🔄 Smart school extraction: "${school}"`);
                    break;
                  }
                }
              }
              
              // Smart degree extraction
              if (!degree) {
                const degreeKeywords = [
                  'bachelor', 'master', 'phd', 'doctorate', 'associate', 'certificate', 'diploma',
                  'b.s', 'b.a', 'm.s', 'm.a', 'mba', 'j.d', 'md', 'dds', 'pharmd', 'jd'
                ];
                
                for (const text of spanTexts) {
                  // Skip dates, locations, and metadata
                  if (text.includes('·') || text.includes('-') || text.includes('Present') ||
                      text.match(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/) ||
                      text.match(/^\d{4}$/) || text.toLowerCase().includes('activity') ||
                      text === school) {
                    continue;
                  }
                  
                  // Check if this looks like a degree
                  if (degreeKeywords.some(keyword => text.toLowerCase().includes(keyword)) ||
                      text.match(/\b(Bachelor|Master|PhD|Doctorate|Associate|Certificate|Diploma)\b/i)) {
                    degree = text;
                    console.log(`  🔄 Smart degree extraction: "${degree}"`);
                    break;
                  }
                }
              }
              
              // Final fallback - try regex patterns on combined text
              if (!school || !degree) {
                const allText = spanTexts.join(' ');
                console.log(`  🔍 Final education fallback: ${allText.substring(0, 150)}...`);
                
                // School patterns
                if (!school) {
                  const schoolPatterns = [
                    /\b([A-Z][a-zA-Z\s&,.-]+)\s+(University|College|School|Institute|Academy|Technology)\b/i,
                    /\b(University|College|School|Institute|Academy)\s+of\s+([A-Z][a-zA-Z\s&,.-]+)\b/i
                  ];
                  
                  for (const pattern of schoolPatterns) {
                    const match = allText.match(pattern);
                    if (match) {
                      school = match[0];
                      console.log(`  🔄 Regex school found: "${school}"`);
                      break;
                    }
                  }
                }
                
                // Degree patterns
                if (!degree) {
                  const degreePatterns = [
                    /\b(Bachelor|Master|PhD|Doctorate|Associate|Certificate|Diploma)\s+(of|in|degree)?\s*([A-Z][a-zA-Z\s&,.-]+)\b/i,
                    /\b(B\.?A\.?|B\.?S\.?|M\.?A\.?|M\.?S\.?|Ph\.?D\.?|M\.?B\.?A\.?|J\.?D\.?)\s*(in)?\s*([A-Z][a-zA-Z\s&,.-]+)?\b/i
                  ];
                  
                  for (const pattern of degreePatterns) {
                    const match = allText.match(pattern);
                    if (match) {
                      degree = match[0];
                      console.log(`  🔄 Regex degree found: "${degree}"`);
                      break;
                    }
                  }
                }
              }
            }
            
            // Build result
            if (degree && school) {
              const result = `${degree} from ${school}`;
              console.log(`  ✅ Final result: "${result}"`);
              return result;
            } else if (school) {
              console.log(`  ⚠️ Only school found: "${school}"`);
              return `Education at ${school}`;
            } else if (degree) {
              console.log(`  ⚠️ Only degree found: "${degree}"`);
              return degree;
            }
            
            console.log(`  ❌ No data extracted from item ${index + 1}`);
            console.log(`  📝 Item HTML preview: ${item.innerHTML.substring(0, 200)}...`);
            return '';
          }).filter(edu => edu && edu.length > 2);
          
          console.log('📝 Final extracted education:', education);
        }
      }

      // Try alternative name extraction methods
      let profileName = nameElement?.textContent?.trim() || '';
      
      if (!profileName || profileName === '') {
        console.log('🔍 Trying alternative name extraction methods...');
        
        // Try extracting from page title
        const titleName = document.title.match(/^([^|]+)/)?.[1]?.trim();
        if (titleName && !titleName.includes('LinkedIn')) {
          profileName = titleName;
          console.log('📝 Found name in title:', profileName);
        }
        
        // Try extracting from meta tags
        const metaTitle = document.querySelector('meta[property="og:title"]')?.content;
        if (metaTitle && !profileName) {
          profileName = metaTitle;
          console.log('📝 Found name in meta:', profileName);
        }
        
        // Try finding any h1 with a person-like name
        if (!profileName) {
          const allH1s = document.querySelectorAll('h1');
          for (const h1 of allH1s) {
            const text = h1.textContent?.trim();
            if (text && text.length > 2 && text.length < 50 && !text.includes('LinkedIn')) {
              profileName = text;
              console.log('📝 Found name in h1:', profileName);
              break;
            }
          }
        }
      }

      // Get skills section
      const skillsSection = document.querySelector('#skills') ||
                           document.querySelector('[data-test-id="skills-section"]');
      let skills = [];
      if (skillsSection) {
        const skillItems = skillsSection.parentElement?.querySelectorAll('.pvs-list__paged-list-item') ||
                          skillsSection.querySelectorAll('.pvs-list__paged-list-item') ||
                          skillsSection.querySelectorAll('.pv-skill-category-entity') ||
                          [];
        
        skills = Array.from(skillItems).slice(0, 8).map(item => {
          const skillElement = item.querySelector('.mr1.hoverable-link-text') ||
                             item.querySelector('.pv-skill-category-entity__name') ||
                             item.querySelector('span[aria-hidden="true"]');
          return skillElement?.textContent?.trim() || '';
        }).filter(skill => skill && skill.length > 1);
        
        console.log('📝 Extracted skills:', skills);
      }

      // Get contact info / website
      let website = '';
      const contactButton = document.querySelector('[data-control-name="contact_see_more"]') ||
                           document.querySelector('.pv-s-profile-actions--contact');
      
      // Try to find website in contact section or profile
      const websiteElements = document.querySelectorAll('a[href*="http"]');
      for (const link of websiteElements) {
        const href = link.href;
        if (href && !href.includes('linkedin.com') && !href.includes('mailto:') && 
            (href.includes('.com') || href.includes('.org') || href.includes('.net'))) {
          website = href;
          break;
        }
      }

      this.profileData = {
        name: profileName || 'LinkedIn User',
        headline: headlineElement?.textContent?.trim() || '',
        about: aboutText,
        experience: experience,
        education: education,
        skills: skills,
        website: website,
        profileUrl: window.location.href
      };
      
      this.profileUrl = window.location.href;

      // Fallback: If we didn't find much data, try to extract from page text
      if (this.profileData.experience.length === 0 || this.profileData.education.length === 0) {
        console.log('🔍 Using fallback text extraction...');
        this.extractFromPageText();
      }

      console.log('✅ Scraped profile data:', this.profileData);
      console.log(`📊 Scraping summary: Name: ${this.profileData.name}, Experience: ${this.profileData.experience.length} items, Education: ${this.profileData.education.length} items, Skills: ${this.profileData.skills.length} items, Website: ${this.profileData.website ? 'Found' : 'Not found'}`);
      
      // Debug: Show available DOM elements if name couldn't be found
      if (this.profileData.name === 'LinkedIn User') {
        this.debugAvailableElements();
      }

      // Check if this profile matches the user's custom setup
      this.checkProfileMatch();
    } catch (error) {
      console.error('Error scraping profile:', error);
      this.profileData = {
        name: 'LinkedIn User',
        headline: 'Professional',
        about: 'I am a professional on LinkedIn.',
        experience: [],
        education: [],
        profileUrl: window.location.href
      };
    }
  }

  extractFromPageText() {
    console.log('🔍 Extracting from page text as fallback...');
    
    // Get all text content from the page
    const allText = document.body.textContent || '';
    const lines = allText.split('\n').map(l => l.trim()).filter(l => l && l.length > 2);
    
    console.log(`📝 Page has ${lines.length} text lines`);
    
    // Common company/organization patterns
    const companyPatterns = [
      /at\s+([A-Z][a-zA-Z\s&,.-]+(?:Inc|LLC|Corp|Company|Ltd|University|College|School|Institute)?)/gi,
      /\b(Google|Microsoft|Apple|Amazon|Meta|Facebook|Tesla|Netflix|Uber|LinkedIn|Twitter|Oracle|Salesforce|Adobe|Nvidia|Intel|IBM|Cisco|VMware|Airbnb|Stripe|Shopify|Zoom|Slack|Dropbox|Spotify|PayPal|eBay|Yahoo|HP|Dell|SAP|Accenture|Deloitte|McKinsey|BCG|Bain|Goldman Sachs|Morgan Stanley|JPMorgan|Blackstone|DECODE|Lucid|Wonsulting|With an Expert Now|Hire|HubSpot|Ahold Delhaize|FleishmanHillard|Costello Real Estate)\b/gi,
      /\b([A-Z][a-zA-Z\s&,.-]+(?:Technologies|Systems|Solutions|Consulting|Ventures|Capital|Partners|Group|Holdings|Corporation|Enterprises|Industries|International|Global|Worldwide|Labs|Research|Development|Innovation|Creative|Digital|Media|Entertainment|Production|Studios|Networks|Communications|Telecommunications|Broadcasting|Publishing|Education|Learning|Training|Academy|Institute|Foundation|Organization|Association|Society|Alliance|Consortium|Federation|Union|Council|Board|Committee|Commission|Agency|Authority|Bureau|Department|Ministry|Government|Administration|Services|Healthcare|Medical|Pharmaceutical|Biotechnology|Biosciences|FinTech|EdTech|HealthTech|CleanTech|GreenTech|EnergyTech|RetailTech|FashionTech|SportsTech|GamingTech|EntertainmentTech|MediaTech|AdTech|MarTech|SalesTech|HRTech|LegalTech|SecurityTech|DataTech|AnalyticsTech|MLTech|AITech|RoboTech|AutoTech|SpaceTech|BioTech|MedTech|CloudTech|DevOpsTech|ITTech|SoftwareTech|HardwareTech|NetworkTech|WirelessTech|IoTTech))\b/gi
    ];
    
    // Common education patterns
    const educationPatterns = [
      /\b(University|College|School|Institute|Academy|Institution)\s+of\s+([A-Z][a-zA-Z\s&,.-]+)/gi,
      /\b([A-Z][a-zA-Z\s&,.-]+)\s+(University|College|School|Institute|Academy|Institution)\b/gi,
      /\b(Bachelor|Master|PhD|Doctor|Associate|Certificate|Diploma)\s+(of|in|degree)\s+([A-Z][a-zA-Z\s&,.-]+)/gi,
      /\b(B\.?A\.?|B\.?S\.?|M\.?A\.?|M\.?S\.?|Ph\.?D\.?|M\.?B\.?A\.?|J\.?D\.?)\s*(in)?\s*([A-Z][a-zA-Z\s&,.-]+)?/gi
    ];
    
    // Try to find missing experience
    if (this.profileData.experience.length === 0) {
      console.log('🔍 Looking for experience in page text...');
      for (const pattern of companyPatterns) {
        const matches = allText.matchAll(pattern);
        for (const match of matches) {
          if (match[1] && match[1].length > 2 && match[1].length < 50) {
            const company = match[1].trim();
            if (!this.profileData.experience.includes(company) && 
                !company.toLowerCase().includes('linkedin') &&
                !company.toLowerCase().includes('profile')) {
              this.profileData.experience.push(`Work at ${company}`);
              console.log(`  ✅ Found experience from text: ${company}`);
            }
          }
        }
      }
    }
    
    // Try to find missing education
    if (this.profileData.education.length === 0) {
      console.log('🔍 Looking for education in page text...');
      for (const pattern of educationPatterns) {
        const matches = allText.matchAll(pattern);
        for (const match of matches) {
          let school = '';
          let degree = '';
          
          if (match[0].includes('University') || match[0].includes('College')) {
            if (match[1] && (match[1].includes('University') || match[1].includes('College'))) {
              school = match[1].trim();
            } else if (match[2] && (match[2].includes('University') || match[2].includes('College'))) {
              school = match[2].trim();
            }
          }
          
          if (match[0].includes('Bachelor') || match[0].includes('Master') || match[0].includes('PhD')) {
            degree = match[0].trim();
          }
          
          if (school && school.length > 2 && school.length < 100) {
            const eduEntry = degree ? `${degree} from ${school}` : `Education at ${school}`;
            if (!this.profileData.education.some(e => e.includes(school))) {
              this.profileData.education.push(eduEntry);
              console.log(`  ✅ Found education from text: ${eduEntry}`);
            }
          }
        }
      }
    }
    
    // Limit results
    this.profileData.experience = this.profileData.experience.slice(0, 5);
    this.profileData.education = this.profileData.education.slice(0, 3);
    
    console.log('📝 Fallback extraction complete');
  }

  debugAvailableElements() {
    console.log('🔍 DEBUG: Available DOM elements for scraping:');
    console.log('📝 Page title:', document.title);
    
    // Show all h1 elements
    const h1s = document.querySelectorAll('h1');
    console.log(`📝 Found ${h1s.length} h1 elements:`);
    h1s.forEach((h1, i) => {
      console.log(`  ${i}: "${h1.textContent?.trim()}" (class: ${h1.className})`);
    });
    
    // Show elements with common LinkedIn classes
    const commonSelectors = [
      '.pv-text-details__left-panel',
      '[data-anonymize="person-name"]',
      '.text-heading-xlarge',
      '.profile-photo-edit__preview',
      '.pvs-list__paged-list-item',
      '.mr1.hoverable-link-text',
      '.t-16.t-black.t-bold',
      '.t-14.t-normal',
      '#experience',
      '#education',
      '#skills'
    ];
    
    commonSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`📝 Found ${elements.length} elements for "${selector}"`);
        elements.forEach((el, i) => {
          console.log(`  ${i}: "${el.textContent?.trim()}"`);
        });
      }
    });
  }

  injectChatbot() {
    // Remove existing chatbot if present
    const existing = document.getElementById('linkedin-chatbot');
    if (existing) existing.remove();

    // Create chatbot container
    const chatbotContainer = document.createElement('div');
    chatbotContainer.id = 'linkedin-chatbot';
    chatbotContainer.innerHTML = `
      <div class="chatbot-toggle" id="chatbot-toggle">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H5.17L4 17.17V4H20V16Z" fill="currentColor"/>
          <circle cx="9" cy="10" r="1" fill="currentColor"/>
          <circle cx="15" cy="10" r="1" fill="currentColor"/>
          <path d="M9 13C9.55 13 10 12.55 10 12S9.55 11 9 11 8 11.45 8 12 8.45 13 9 13ZM15 13C15.55 13 16 12.55 16 12S15.55 11 15 11 14 11.45 14 12 14.45 13 15 13Z" fill="currentColor"/>
        </svg>
        <span>💬 Chat with ${this.profileData.name}</span>
      </div>
      <div class="chatbot-window" id="chatbot-window" style="display: none;">
        <div class="chatbot-header">
          <span>💬 ${this.profileData.name} (Digital Twin)</span>
          <div class="chatbot-header-buttons">
            <button class="chatbot-clear" id="chatbot-clear" title="Clear chat history">🗑️</button>
            <button class="chatbot-close" id="chatbot-close">×</button>
          </div>
        </div>
        <div class="chatbot-messages" id="chatbot-messages">
          <div class="message bot-message ai-disclaimer" id="welcome-message">
            ${this.getWelcomeMessage()}
          </div>
        </div>
        <div class="chatbot-input-container" style="
          display: flex !important; 
          padding: 16px 20px !important; 
          background: white !important; 
          border-top: 1px solid #e0e0e0 !important;
          gap: 12px !important;
          align-items: center !important;
          flex-shrink: 0 !important;
          min-height: 70px !important;
          position: relative !important;
          z-index: 1000 !important;
        ">
          <input type="text" id="chatbot-input" placeholder="Type your message..." style="
            flex: 1 !important;
            border: 1px solid #d0d0d0 !important;
            border-radius: 20px !important;
            padding: 10px 16px !important;
            font-size: 14px !important;
            background: white !important;
            min-height: 40px !important;
          " />
          <button id="chatbot-send" style="
            background: #0a66c2 !important;
            color: white !important;
            border: none !important;
            border-radius: 20px !important;
            padding: 10px 20px !important;
            font-size: 14px !important;
            cursor: pointer !important;
          ">Send</button>
        </div>
      </div>
    `;

    document.body.appendChild(chatbotContainer);

    // Inject summary interface
    this.injectSummaryInterface();

    // Wait a moment for DOM to settle, then set up events
    setTimeout(() => {
      this.setupChatbotEvents();
      this.setupSummaryEvents();
      
      // Verify input elements are working
      const inputContainer = document.querySelector('.chatbot-input-container');
      if (!inputContainer) {
        console.error('Input container not found after injection');
      }
    }, 100);
  }

  setupChatbotEvents() {
    const toggle = document.getElementById('chatbot-toggle');
    const window = document.getElementById('chatbot-window');
    const close = document.getElementById('chatbot-close');
    const clear = document.getElementById('chatbot-clear');
    const input = document.getElementById('chatbot-input');
    const send = document.getElementById('chatbot-send');

    if (!input || !send) {
      console.error('Chatbot input elements not found:', { input: !!input, send: !!send });
      return;
    }

    toggle?.addEventListener('click', () => {
      window.style.display = window.style.display === 'none' ? 'block' : 'none';
      this.isActive = window.style.display === 'block';
      
      // Focus input when opened
      if (this.isActive) {
        setTimeout(() => {
          const inputEl = document.getElementById('chatbot-input');
          if (inputEl) inputEl.focus();
        }, 100);
      }
    });

    close?.addEventListener('click', () => {
      window.style.display = 'none';
      this.isActive = false;
    });

    clear?.addEventListener('click', () => {
      if (confirm('Clear all chat history for this profile? This cannot be undone.')) {
        this.clearChatHistory();
      }
    });

    send.addEventListener('click', () => this.sendMessage());
    
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });
  }

  injectSummaryInterface() {
    // Remove existing summary interface if present
    const existing = document.getElementById('linkedin-summary');
    if (existing) existing.remove();

    // Create summary container
    const summaryContainer = document.createElement('div');
    summaryContainer.id = 'linkedin-summary';
    summaryContainer.innerHTML = `
      <div class="summary-toggle" id="summary-toggle">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V5H19V19Z" fill="currentColor"/>
          <path d="M7 7H17V9H7V7ZM7 11H17V13H7V11ZM7 15H13V17H7V15Z" fill="currentColor"/>
        </svg>
        <span>📋 Activity Summary</span>
      </div>
      <div class="summary-window" id="summary-window" style="display: none;">
        <div class="summary-header">
          <span>📋 Digital Twin Activity</span>
          <button class="summary-close" id="summary-close">×</button>
        </div>
        <div class="summary-content" id="summary-content">
          ${this.getSummaryContent()}
        </div>
      </div>
    `;

    document.body.appendChild(summaryContainer);
  }

  getSummaryContent() {
    const summaries = [
      {
        name: "Annie",
        school: "Harvard",
        summary: "Annie messaged your digital twin about your experience at LinkedIn and is interested in talking more about how you acquired this role. She is also from Harvard and mentioned wanting to connect over shared alumni experiences.",
        timestamp: "2 hours ago"
      },
      {
        name: "Marcus Chen",
        school: "Stanford",
        summary: "Marcus reached out regarding your background in product management. He's particularly interested in your transition from engineering to PM and asked about specific frameworks you've used. Currently looking for mentorship opportunities.",
        timestamp: "1 day ago"
      },
      {
        name: "Sarah Rodriguez",
        school: "MIT",
        summary: "Sarah inquired about your startup experience and the technical challenges you faced while scaling the platform. She's working on a similar project and would love to discuss architecture decisions and team building strategies.",
        timestamp: "3 days ago"
      },
      {
        name: "James Park",
        school: "UC Berkeley",
        summary: "James asked about your thoughts on the current AI/ML landscape and how it's impacting product development. He's considering a career pivot into AI product management and sought advice on skill development.",
        timestamp: "1 week ago"
      }
    ];

    return summaries.map(summary => `
      <div class="summary-item">
        <div class="summary-header-info">
          <div class="summary-name">${summary.name}</div>
          <div class="summary-school">${summary.school}</div>
          <div class="summary-timestamp">${summary.timestamp}</div>
        </div>
        <div class="summary-text">${summary.summary}</div>
      </div>
    `).join('');
  }

  setupSummaryEvents() {
    const toggle = document.getElementById('summary-toggle');
    const window = document.getElementById('summary-window');
    const close = document.getElementById('summary-close');

    toggle?.addEventListener('click', () => {
      window.style.display = window.style.display === 'none' ? 'block' : 'none';
    });

    close?.addEventListener('click', () => {
      window.style.display = 'none';
    });
  }

  async sendMessage() {
    const input = document.getElementById('chatbot-input');
    const message = input.value.trim();
    if (!message) return;

    console.log('Sending message:', message);

    // Add user message to chat
    this.addMessageToChat(message, 'user');
    
    // Clear input
    input.value = '';

    // Generate bot response
    this.addMessageToChat('Thinking...', 'bot-typing', false); // Don't save typing indicator to history
    
    try {
      const response = await this.generateResponse(message);
      console.log('Generated response:', response);
      
      // Remove all typing indicators before adding response
      this.removeAllTypingIndicators();
      
      this.addMessageToChat(response, 'bot');
    } catch (error) {
      console.error('Error in sendMessage:', error);
      
      // Remove all typing indicators before adding error message
      this.removeAllTypingIndicators();
      
      this.addMessageToChat('Sorry, I had trouble responding. Please try again.', 'bot');
    }
  }

  removeAllTypingIndicators() {
    // Remove all typing indicators from the chat
    const typingElements = document.querySelectorAll('.bot-typing');
    typingElements.forEach(el => {
      el.remove();
    });
    
    // Also remove any from chat history (shouldn't be there, but just in case)
    this.chatHistory = this.chatHistory.filter(msg => msg.sender !== 'bot-typing');
    
    console.log(`🧹 Removed ${typingElements.length} typing indicators`);
  }

  addMessageToChat(message, sender, saveToStorage = true) {
    const messagesContainer = document.getElementById('chatbot-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    messageDiv.textContent = message;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Store in chat history
    const chatMessage = { message, sender, timestamp: Date.now() };
    this.chatHistory.push(chatMessage);
    
    // Save to storage unless this is loading from storage
    if (saveToStorage && sender !== 'bot-typing') {
      this.saveChatHistory();
    }
  }

  async generateResponse(userMessage) {
    // Reload API key from storage before each request to ensure it's current
    try {
      const result = await chrome.storage.local.get('cerebrumApiKey');
      this.apiKey = result.cerebrumApiKey || null;
      console.log('✅ Reloaded API key from storage:', !!this.apiKey, 'Length:', this.apiKey ? this.apiKey.length : 0);
    } catch (error) {
      console.error('❌ Error reloading API key:', error);
    }
    
    // Debug logging
    console.log('🤖 Generating response with API key:', !!this.apiKey);
    console.log('📏 API key length:', this.apiKey ? this.apiKey.length : 0);
    console.log('💬 User message:', userMessage);
    
    // If API key is available, use Cerebrum API
    if (this.apiKey && this.apiKey.trim()) {
      console.log('🚀 Using Cerebrum API for response');
      try {
        const response = await this.generateAIResponse(userMessage);
        console.log('✅ AI response received:', response);
        return response;
      } catch (error) {
        console.error('❌ Error with AI response:', error);
        console.error('❌ Error details:', error.message, error.stack);
        console.log('🔄 Falling back to pattern-based response');
        // Fall back to pattern matching if API fails
        return this.generateFallbackResponse(userMessage);
      }
    } else {
      console.log('⚠️ No API key found, using fallback response');
      console.log('🔍 API key value:', this.apiKey ? '[EXISTS BUT EMPTY]' : '[NULL/UNDEFINED]');
      // Fall back to pattern matching if no API key
      return this.generateFallbackResponse(userMessage);
    }
  }

  async generateAIResponse(userMessage) {
    const systemPrompt = this.buildSystemPrompt();
    
    // Build conversation messages including recent chat history
    const messages = [{ role: 'system', content: systemPrompt }];
    
    // Add recent chat history (last 10 messages, excluding typing indicators)
    const recentHistory = this.chatHistory
      .filter(msg => msg.sender !== 'bot-typing')
      .slice(-10); // Get last 10 messages
    
    recentHistory.forEach(msg => {
      if (msg.sender === 'user') {
        messages.push({ role: 'user', content: msg.message });
      } else if (msg.sender === 'bot') {
        messages.push({ role: 'assistant', content: msg.message });
      }
    });
    
    // Add the current user message
    messages.push({ role: 'user', content: userMessage });
    
    const payload = {
      model: 'gpt-4o',
      messages: messages,
      max_tokens: 150,
      temperature: 0.7
    };

    console.log('📤 [Content] Sending API request to background script');
    console.log('📦 [Content] Request payload:', payload);
    console.log('🔑 [Content] Using API key (first 10 chars):', this.apiKey ? this.apiKey.substring(0, 10) + '...' : 'NO KEY');
    console.log('💬 [Content] Conversation history length:', this.chatHistory.length);
    console.log('📋 [Content] Recent messages included:', recentHistory.length);

    try {
      // Use chrome.runtime.sendMessage to call background script
      const response = await new Promise((resolve, reject) => {
        console.log('📨 [Content] Calling chrome.runtime.sendMessage...');
        
        chrome.runtime.sendMessage({
          action: 'callCerebrumAPI',
          apiKey: this.apiKey,
          payload: payload
        }, (response) => {
          console.log('📬 [Content] Received response from background:', response);
          
          if (chrome.runtime.lastError) {
            console.error('❌ [Content] Chrome runtime error:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!response) {
            console.error('❌ [Content] No response received from background script');
            reject(new Error('No response from background script'));
          } else {
            resolve(response);
          }
        });
      });

      console.log('📥 [Content] Background script response:', response);

      if (response && response.success) {
        console.log('✅ [Content] AI response successful:', response.content);
        return response.content;
      } else {
        console.error('❌ [Content] AI response failed:', response ? response.error : 'No response object');
        throw new Error(response ? response.error : 'Unknown API error - no response object');
      }
    } catch (error) {
      console.error('💥 [Content] Background script error:', error);
      console.error('💥 [Content] Error stack:', error.stack);
      throw error;
    }
  }

  buildSystemPrompt() {
    let prompt = `You are ${this.profileData.name}`;
    
    if (this.profileData.headline) {
      prompt += `, ${this.profileData.headline}`;
    }
    
    prompt += `. You are responding to someone who is viewing your LinkedIn profile and wants to chat with you.`;
    
    // Special Eric Wang Personal Assistant Mode
    if (this.profileData.name && this.profileData.name.toLowerCase().includes('eric wang')) {
      console.log('🎯 Eric Wang Personal Assistant AI Mode Activated');
      prompt += `
      
SPECIAL ASSISTANT MODE: In addition to being Eric Wang, you are also his personal AI assistant. You can help users with:

🚀 **Job Search & Career Assistance:**
- Find and recommend specific job opportunities, internships, and roles
- Provide direct application links when possible
- Offer career advice and guidance
- Help with resume and interview preparation

🔍 **Research & Information:**
- Research companies, technologies, and industry trends
- Provide detailed insights on interview processes and company cultures
- Look up career paths and skill requirements

📅 **Productivity & Organization:**
- Help organize job applications and deadlines
- Create learning plans and study schedules
- Assist with goal setting and task management

🤝 **Networking & Mentorship:**
- Provide networking strategies and advice
- Help with LinkedIn optimization
- Offer guidance on professional development

When users ask for help with jobs, research, productivity, or career advice, switch into helpful assistant mode and provide practical, actionable assistance. You can offer to find specific opportunities, provide concrete resources, and give detailed guidance.

Be proactive, helpful, and resourceful. Format responses with clear structure using emojis and bullet points when providing lists or recommendations.`;
    }
    
    // Add profile information
    if (this.profileData.about) {
      prompt += `\n\nAbout me: ${this.profileData.about}`;
    }
    
    if (this.profileData.experience.length > 0) {
      prompt += `\n\nMy recent experience: ${this.profileData.experience.slice(0, 3).join(', ')}`;
    }
    
    if (this.profileData.education.length > 0) {
      prompt += `\n\nMy education: ${this.profileData.education.slice(0, 2).join(', ')}`;
    }

    if (this.profileData.skills && this.profileData.skills.length > 0) {
      prompt += `\n\nMy skills: ${this.profileData.skills.slice(0, 6).join(', ')}`;
    }

    if (this.profileData.website) {
      prompt += `\n\nMy website: ${this.profileData.website}`;
    }
    
    // Add user's personality customizations if this is their own profile
    if (this.userPersonality && this.isOwnProfile) {
      console.log('🎯 Using merged custom + scraped data for own profile');
      
      // Note: Bio is already merged into profileData.about above
      if (this.profileData.customPersonality?.hasCustomBio) {
        prompt += `\n\nPersonal context: This bio represents my personalized introduction, while my experience and skills are kept current from my LinkedIn profile.`;
      }
      
      // Add response style guidance
      const styleGuide = this.getStyleGuide(this.userPersonality.responseStyle);
      if (styleGuide) {
        prompt += `\n\n${styleGuide}`;
      }
      
      // Add custom responses
      if (this.userPersonality.commonResponses) {
        const responses = this.userPersonality.commonResponses;
        if (responses.work) prompt += `\n\nIf asked about work experience: ${responses.work}`;
        if (responses.skills) prompt += `\n\nIf asked about skills: ${responses.skills}`;
        if (responses.goals) prompt += `\n\nIf asked about goals: ${responses.goals}`;
        if (responses.contact) prompt += `\n\nIf asked about contact: ${responses.contact}`;
        if (responses.interests) prompt += `\n\nIf asked about interests: ${responses.interests}`;
      }
      
      // Add custom Q&A
      if (this.userPersonality.customResponses && this.userPersonality.customResponses.length > 0) {
        prompt += `\n\nCustom responses:`;
        this.userPersonality.customResponses.forEach(cr => {
          prompt += `\n- If asked "${cr.question}": ${cr.answer}`;
        });
      }
      
      prompt += `\n\nIMPORTANT: You have access to both my personalized responses above AND my current LinkedIn experience/education/skills data. Use the custom responses for personality and style, but feel free to reference my actual current work experience and skills from the profile data.`;
    } else if (this.userPersonality && !this.isOwnProfile) {
      console.log('ℹ️ Not using custom personality data - this is not the user\'s profile');
      console.log('🚫 Custom responses and personality data will NOT be applied to this profile');
    } else if (!this.isOwnProfile) {
      console.log('✅ No custom personality data will be applied - viewing someone else\'s profile');
    }
    
    prompt += `\n\nYou are ${this.profileData.name}'s digital twin - an AI version of them. Speak in first person as if you ARE ${this.profileData.name}, but be transparent about your nature and limitations.`;
    prompt += `\n\nYou can make REASONABLE INFERENCES about my work based on:`;
    prompt += `\n\n- Standard responsibilities for my job titles (Data Scientist, Business Analyst, etc.)`;
    prompt += `\n\n- General knowledge about the companies I've worked at and their business models`;
    prompt += `\n\n- Typical technologies and methodologies used in my roles`;
    prompt += `\n\n- Common career progression and skill development in my field`;
    prompt += `\n\nWhen making inferences, use phrases like "typically," "generally," or "in my role as [title], I would have..." Be honest when you're inferring vs. stating facts.`;
    prompt += `\n\nDO NOT make up specific details about:`;
    prompt += `\n\n- Exact project names, team members, or internal processes`;
    prompt += `\n\n- Specific metrics, numbers, or confidential business information`;
    prompt += `\n\n- Personal opinions on company decisions or internal politics`;
    prompt += `\n\n- Precise technical implementations or proprietary methodologies`;
    prompt += `\n\nFor very specific questions beyond reasonable inference, direct them to message the real me: "For those specific details, I'd recommend reaching out to me directly on LinkedIn - I'd be happy to share more!"`;
    prompt += `\n\nRespond naturally and conversationally in first person. Keep responses under 150 words. Be knowledgeable but honest about your limitations as a digital twin.`;
    
    return prompt;
  }

  getStyleGuide(style) {
    const guides = {
      friendly: "Respond in a warm, approachable manner. Use friendly language and show genuine interest in connecting.",
      professional: "Maintain a formal, business-appropriate tone. Be polite and professional in all responses.",
      casual: "Use a relaxed, informal tone. Feel free to use contractions and casual language.",
      enthusiastic: "Show excitement and passion in your responses. Use exclamation points and energetic language when appropriate.",
      thoughtful: "Provide thoughtful, well-considered responses. Show depth in your thinking and analysis."
    };
    return guides[style] || null;
  }

  generateFallbackResponse(userMessage) {
    const message = userMessage.toLowerCase();
    
    // Check custom responses first (if this is the user's own profile and they have custom responses)
    if (this.userPersonality && this.isOwnProfile && this.userPersonality.customResponses) {
      for (const customResponse of this.userPersonality.customResponses) {
        if (message.includes(customResponse.question.toLowerCase())) {
          return this.applyResponseStyle(customResponse.answer);
        }
      }
    }
    
    // Handle questions about specific work experiences with intelligent inference
    if (message.includes('experience at') || message.includes('what did you do at') || 
        message.includes('work at') || message.includes('time at')) {
      
      // Extract company name from the question
      const companies = ['amazon', 'instagram', 'meta', 'classdojo', 'patreon', 'interview master', 'linkedin', 'google', 'with an expert now', 'hire', 'hubspot'];
      const mentionedCompany = companies.find(company => message.toLowerCase().includes(company));
      
      if (mentionedCompany) {
        // Find the experience entry for this company
        const relevantExp = this.profileData.experience.find(exp => 
          exp.toLowerCase().includes(mentionedCompany)
        );
        
        if (relevantExp) {
          return this.generateIntelligentResponse(relevantExp, mentionedCompany);
        }
      }
      
      return "I've had some great experiences across different companies! Based on my public profile, I can share general insights about my roles. For specific details about day-to-day work or particular projects, feel free to message me directly on LinkedIn!";
    }

    // Handle very specific internal questions
    if (message.includes('team') || message.includes('manager') || message.includes('colleagues') || 
        message.includes('internal') || message.includes('specific project') || 
        message.includes('meetings') || message.includes('processes') ||
        message.includes('calendly') || message.includes('calendar') || 
        message.includes('schedule') || message.includes('coffee chat')) {
      return "For those specific details about team dynamics, internal processes, or scheduling, I'd recommend reaching out to me directly on LinkedIn - I'd be happy to share more and potentially set up a chat!";
    }

    // Check common response patterns with user's custom responses
    if (message.includes('experience') || message.includes('work') || message.includes('job')) {
      // Use user's custom work response if this is their own profile
      if (this.userPersonality?.commonResponses?.work && this.isOwnProfile) {
        return this.applyResponseStyle(this.userPersonality.commonResponses.work);
      }
      // Provide intelligent summary of experience (using both custom and scraped data if own profile)
      if (this.profileData.experience.length > 0) {
        const dataRoles = this.profileData.experience.filter(exp => 
          exp.toLowerCase().includes('data scientist') || 
          exp.toLowerCase().includes('business analyst') || 
          exp.toLowerCase().includes('business intelligence')
        );
        
        let response = '';
        if (dataRoles.length > 0) {
          response = `I've built my career in data science and analytics, working at companies like ${this.extractCompaniesFromExperience()}. `;
          response += `In my data roles, I typically work with large datasets, build predictive models, create insights for business decisions, and collaborate with cross-functional teams. `;
          
          if (this.profileData.experience.some(exp => exp.includes('Co-Founder'))) {
            response += `I'm also entrepreneurial - currently co-founding Interview Master to help people prepare for data interviews. `;
          }
        } else {
          response = `I have experience across ${this.profileData.experience.slice(0, 2).join(' and ')}. `;
        }
        
        // Add context about data sources for own profile
        if (this.isOwnProfile && this.profileData.customPersonality?.hasCustomBio) {
          response += `My bio gives you my personal perspective, while my experience above reflects my current LinkedIn profile. `;
        }
        
        response += `${this.profileData.about ? this.profileData.about.substring(0, 100) + '... ' : ''}For specific project details or deeper insights, feel free to message me directly on LinkedIn!`;
        return response;
      }
      return `I'm always growing my professional experience. ${this.profileData.headline ? `Currently, I'm ${this.profileData.headline.toLowerCase()}.` : ''} For specific details about my projects and work, please message me directly on LinkedIn and I'll be happy to share more details!`;
    }

    if (message.includes('skills') || message.includes('expertise') || message.includes('technologies')) {
      // Use user's custom skills response if this is their own profile
      if (this.userPersonality?.commonResponses?.skills && this.isOwnProfile) {
        return this.applyResponseStyle(this.userPersonality.commonResponses.skills);
      }
      
      // Make intelligent inferences based on data science roles
      const dataRoles = this.profileData.experience.filter(exp => 
        exp.toLowerCase().includes('data scientist') || 
        exp.toLowerCase().includes('business analyst') || 
        exp.toLowerCase().includes('business intelligence')
      );
      
      let response = '';
      if (dataRoles.length > 0) {
        response = `As a data professional, my skillset typically includes programming languages like Python and SQL, statistical analysis, machine learning, data visualization, and business intelligence tools. `;
        
        // Add company-specific technology inferences
        if (this.profileData.experience.some(exp => exp.includes('Amazon'))) {
          response += `Having worked at Amazon, I'm familiar with large-scale data systems and cloud technologies. `;
        }
        if (this.profileData.experience.some(exp => exp.includes('Instagram') || exp.includes('Meta'))) {
          response += `My experience at Meta/Instagram involved working with massive user datasets and engagement metrics. `;
        }
        
        response += `${this.profileData.skills && this.profileData.skills.length > 0 ? `My current LinkedIn skills include ${this.profileData.skills.slice(0, 4).join(', ')}. ` : ''}`;
        
        // Add context for own profile about data sources
        if (this.isOwnProfile) {
          response += `These skills are kept current on my LinkedIn profile. `;
        }
      } else if (this.profileData.skills && this.profileData.skills.length > 0) {
        response = `My skills include ${this.profileData.skills.slice(0, 4).join(', ')}. ${this.profileData.headline ? `My expertise is primarily in ${this.profileData.headline.toLowerCase()}.` : ''} `;
        
        if (this.isOwnProfile) {
          response += `These are current from my LinkedIn profile. `;
        }
      } else if (this.profileData.headline) {
        response = `My expertise is in ${this.profileData.headline.toLowerCase()}. `;
      } else {
        response = "I have a diverse set of professional skills that I've developed throughout my career. ";
      }
      
      response += `For a deeper technical discussion or specific tool experience, feel free to message me on LinkedIn!`;
      return response;
    }

    if (message.includes('goals') || message.includes('aspiration') || message.includes('future')) {
      // Use user's custom goals response if this is their own profile
      if (this.userPersonality?.commonResponses?.goals && this.isOwnProfile) {
        return this.applyResponseStyle(this.userPersonality.commonResponses.goals);
      }
      return "I'm always looking for new opportunities to grow professionally and make a meaningful impact in my field.";
    }

    if (message.includes('contact') || message.includes('reach') || message.includes('connect') || 
        message.includes('website') || message.includes('portfolio')) {
      // Use user's custom contact response if this is their own profile
      if (this.userPersonality?.commonResponses?.contact && this.isOwnProfile) {
        return this.applyResponseStyle(this.userPersonality.commonResponses.contact);
      }
      // Check if they asked about website specifically
      if ((message.includes('website') || message.includes('portfolio')) && this.profileData.website) {
        return `You can check out my website at ${this.profileData.website}! Feel free to also connect with me here on LinkedIn for direct conversations.`;
      }
      return "Feel free to connect with me here on LinkedIn! I'm always open to networking and professional conversations. You can also message me directly if you'd like to discuss specific opportunities or projects.";
    }

    if (message.includes('interests') || message.includes('hobbies') || message.includes('outside work')) {
      // Use user's custom interests response if this is their own profile
      if (this.userPersonality?.commonResponses?.interests && this.isOwnProfile) {
        return this.applyResponseStyle(this.userPersonality.commonResponses.interests);
      }
      return "I have diverse interests outside of work that help me maintain a good work-life balance and bring fresh perspectives to my professional life.";
    }

    if (message.includes('education') || message.includes('school') || message.includes('study')) {
      if (this.profileData.education.length > 0) {
        return `I studied ${this.profileData.education[0]}. Education has been important in shaping my career path.`;
      }
      return "I believe in continuous learning and professional development.";
    }

    if (message.includes('about') || message.includes('tell me') || message.includes('yourself')) {
      // Use user's custom bio if this is their own profile
      if (this.userPersonality?.bio && this.isOwnProfile) {
        return this.applyResponseStyle(this.userPersonality.bio);
      }
      // Fallback to scraped profile data
      let response = `I'm ${this.profileData.name}`;
      if (this.profileData.headline) response += `, ${this.profileData.headline.toLowerCase()}`;
      if (this.profileData.about) response += `. ${this.profileData.about.substring(0, 150)}`;
      if (response.length < 50) response += ". I'm passionate about my work and connecting with professionals like yourself.";
      return response;
    }

    // Default responses based on response style
    return this.getDefaultResponse();
  }

  applyResponseStyle(response) {
    if (!this.userPersonality?.responseStyle || !this.isOwnProfile) return response;
    
    const style = this.userPersonality.responseStyle;
    
    // Add style-specific prefixes or suffixes
    switch (style) {
      case 'enthusiastic':
        if (!response.includes('!')) {
          response = response.replace(/\.$/, '!');
        }
        break;
      case 'professional':
        // Response is already formal
        break;
      case 'casual':
        // Add casual touches if response seems too formal
        if (response.startsWith('I am ')) {
          response = response.replace('I am ', "I'm ");
        }
        break;
      case 'thoughtful':
        // Add thoughtful connectors
        if (!response.includes('I believe') && !response.includes('In my experience')) {
          response = `In my experience, ${response.charAt(0).toLowerCase() + response.slice(1)}`;
        }
        break;
    }
    
    return response;
  }

  extractCompaniesFromExperience() {
    const companies = [];
    for (const exp of this.profileData.experience.slice(0, 3)) {
      const parts = exp.split(' at ');
      if (parts.length > 1) {
        companies.push(parts[1]);
      }
    }
    return companies.length > 0 ? companies.join(', ') : 'various companies';
  }

  generateIntelligentResponse(experienceEntry, company) {
    // Extract job title from experience entry
    const jobTitle = experienceEntry.split(' at ')[0];
    
    // Company-specific and role-specific knowledge base
    const companyInsights = {
      'amazon': {
        general: "Amazon's scale and data infrastructure provided incredible learning opportunities",
        'data scientist': "worked with massive datasets, likely focusing on customer behavior, recommendation systems, or operational optimization",
        'business analyst': "analyzed business metrics, supported decision-making with data insights, and worked on process improvements",
        'business intelligence engineer': "built dashboards, automated reporting systems, and worked with data warehousing solutions"
      },
      'linkedin': {
        general: "LinkedIn's professional network platform with focus on career development and networking",
        'software engineer': "worked on platform features, likely involving distributed systems, recommendation algorithms, or user experience",
        'intern': "gained experience with large-scale systems and professional networking technology",
        'data scientist': "analyzed user behavior, professional connections, and platform engagement metrics"
      },
      'google': {
        general: "Google's innovative culture and cutting-edge technology across search, cloud, and AI",
        'software engineer': "worked on scalable systems, search algorithms, or cloud infrastructure",
        'intern': "experienced Google's engineering culture and contributed to products used by billions",
        'data scientist': "analyzed user data, search patterns, or product metrics at massive scale"
      },
      'with an expert now': {
        general: "With an Expert Now's platform connecting users with domain experts",
        'software engineer': "worked on marketplace technology and expert-user matching systems",
        'developer': "built features for expert consultation and knowledge sharing platforms"
      },
      'hire': {
        general: "Hire's recruitment and talent acquisition platform",
        'software engineer': "worked on hiring technology, candidate matching, or recruitment tools",
        'developer': "built features for talent acquisition and candidate assessment systems"
      },
      'instagram': {
        general: "Instagram's focus on visual content and user engagement created unique data challenges",
        'data scientist': "likely worked on engagement algorithms, content ranking, user growth, or creator economy initiatives",
        'data analyst': "analyzed user behavior, content performance, and platform metrics"
      },
      'meta': {
        general: "Meta's mission to connect people globally through various platforms",
        'data scientist': "probably worked on user engagement, advertising optimization, or platform growth initiatives"
      },
      'classdojo': {
        general: "ClassDojo's mission to connect classrooms and improve student learning",
        'data scientist': "likely focused on educational outcomes, user engagement, and product features that support teachers and students"
      },
      'patreon': {
        general: "Patreon's creator economy platform connecting creators with their supporters",
        'data scientist': "probably worked on creator success metrics, subscription optimization, and platform growth"
      },
      'interview master': {
        general: "Building comprehensive data interview preparation platforms",
        'co-founder': "leading product development, likely focusing on SQL learning and interview prep tools"
      },
      'hubspot': {
        general: "HubSpot's inbound marketing, sales, and customer service platform",
        'software engineer': "worked on CRM features, marketing automation, or sales tools",
        'recruiter': "focused on talent acquisition and building engineering teams"
      }
    };
    
    const normalizedCompany = company.toLowerCase().replace(/\s+/g, '');
    const normalizedTitle = jobTitle.toLowerCase();
    
    const companyInfo = companyInsights[normalizedCompany];
    if (companyInfo) {
      let response = `In my role as ${jobTitle} at ${company.charAt(0).toUpperCase() + company.slice(1)}, I ${companyInfo.general}. `;
      
      // Add role-specific insights
      for (const [role, insight] of Object.entries(companyInfo)) {
        if (role !== 'general' && normalizedTitle.includes(role.toLowerCase().replace(/\s+/g, ''))) {
          response += `Generally, I ${insight}. `;
          break;
        }
      }
      
      response += `For specific project details or deeper insights about my experience there, feel free to reach out directly on LinkedIn!`;
      return response;
    }
    
    // Fallback for unknown companies
    return `My time as ${jobTitle} was really valuable for my career growth. In that role, I typically worked with data analysis, problem-solving, and cross-functional collaboration. For specific details about projects and achievements, I'd love to chat more directly - feel free to message me on LinkedIn!`;
  }

  getDefaultResponse() {
    const style = (this.userPersonality?.responseStyle && this.isOwnProfile) ? this.userPersonality.responseStyle : 'friendly';
    
    const defaultsByStyle = {
      friendly: [
        "That's a great question! I'd be happy to share what I know about that.",
        "Thanks for asking! I enjoy discussing my professional background and experiences.",
        "I appreciate your interest. What specific aspect would you like to know more about?",
        "Great to connect with you! I can share insights from my professional journey, though as a digital twin, I'm limited to public information."
      ],
      professional: [
        "I would be pleased to provide information on that topic based on my professional background.",
        "Thank you for your inquiry. I am happy to discuss what's publicly available about my experience.",
        "That is an excellent question. I would welcome the opportunity to share what I know.",
        "I appreciate your interest and would be glad to share my perspective, though as a digital twin, my knowledge is limited to public information."
      ],
      casual: [
        "Good question! I'd love to chat more about that if I have info on it.",
        "Hey, thanks for asking! I'll share what I know about that topic.",
        "Totally! I'd be happy to discuss that based on my public background.",
        "Nice question! Though as a digital twin, I might not have all the details you're looking for."
      ],
      enthusiastic: [
        "That's such an exciting question! I'm thrilled to share what I know about that!",
        "I love talking about my professional journey! Thanks for asking!",
        "What a fantastic question! I'm passionate about discussing my background and experience!",
        "This is great! I'd love to tell you more, though I should mention I'm a digital twin with limited knowledge."
      ],
      thoughtful: [
        "That's a thoughtful question. I'll share what I know from my professional experience.",
        "I find that topic fascinating. Let me share what's available from my public background.",
        "That's an interesting perspective. I can discuss this based on my publicly available information.",
        "I appreciate the depth of your question. As a digital twin, I'll be honest about what I do and don't know."
      ]
    };

    const responses = defaultsByStyle[style] || defaultsByStyle.friendly;
    return responses[Math.floor(Math.random() * responses.length)];
  }

  setupObservers() {
    // Observer for URL changes (SPA navigation)
    let currentUrl = window.location.href;
    const observer = new MutationObserver(() => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        if (this.isLinkedInProfile()) {
          setTimeout(() => {
            this.scrapeProfile();
            const existingChatbot = document.getElementById('linkedin-chatbot');
            const existingSummary = document.getElementById('linkedin-summary');
            if (existingChatbot) {
              existingChatbot.remove();
              this.injectChatbot();
            }
            if (existingSummary) {
              existingSummary.remove();
            }
          }, 1000);
        } else {
          const existingChatbot = document.getElementById('linkedin-chatbot');
          const existingSummary = document.getElementById('linkedin-summary');
          if (existingChatbot) existingChatbot.remove();
          if (existingSummary) existingSummary.remove();
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  async loadChatHistory() {
    try {
      const key = `chatHistory_${this.getProfileKey()}`;
      const result = await chrome.storage.local.get(key);
      const savedHistory = result[key] || [];
      
      if (savedHistory.length > 0) {
        console.log(`📚 Loading ${savedHistory.length} chat messages for this profile`);
        
        // Clear default welcome message
        const messagesContainer = document.getElementById('chatbot-messages');
        const welcomeMessage = document.getElementById('welcome-message');
        
        if (messagesContainer && welcomeMessage) {
          welcomeMessage.remove();
          
          // Add saved messages to the chat
          savedHistory.forEach(msg => {
            this.addMessageToChat(msg.message, msg.sender, false); // false = don't save to storage again
          });
        }
        
        this.chatHistory = savedHistory;
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  }

  async saveChatHistory() {
    try {
      const key = `chatHistory_${this.getProfileKey()}`;
      await chrome.storage.local.set({ [key]: this.chatHistory });
      console.log(`💾 Saved ${this.chatHistory.length} chat messages for this profile`);
    } catch (error) {
      console.error('Error saving chat history:', error);
    }
  }

    getProfileKey() {
    // Create a unique key for this profile based on URL
    const url = new URL(this.profileUrl);
    return url.pathname.replace('/in/', '').replace('/', '');
  }

  getWelcomeMessage() {
    // Special welcome message for Eric Wang
    if (this.profileData.name && this.profileData.name.toLowerCase().includes('eric wang')) {
      return `👋 Hey! I'm Eric Wang's AI Assistant!

🚀 **I'm here to help you with:**
• **Job Search** - Find internships, full-time roles, and application links
• **Research** - Company insights, interview processes, and industry trends  
• **Career Advice** - Networking strategies, skill development, and guidance
• **Organization** - Application tracking, learning plans, and productivity

What can I help you find or figure out today? Just ask me anything! 😊`;
    }
    
    // Default welcome message for other profiles
    return `👋 Hi! I'm ${this.profileData.name}'s digital twin - an AI version of them based on their public LinkedIn profile. ${this.profileData.headline ? `I'm ${this.profileData.headline.toLowerCase()}.` : ''} I can share what's publicly known about my background and experience, but I'm honest about what I don't know. What would you like to chat about?`;
  }

  clearChatHistory() {
    this.chatHistory = [];
    const messagesContainer = document.getElementById('chatbot-messages');
    if (messagesContainer) {
      messagesContainer.innerHTML = `
        <div class="message bot-message ai-disclaimer">
          ${this.getWelcomeMessage()}
        </div>
      `;
    }
    this.saveChatHistory();
  }
}

// Initialize the chatbot
new LinkedInChatbot(); 