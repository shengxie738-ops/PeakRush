/**
 * legal.ts — /terms-and-conditions, /privacy-policy, /cookies-policy.
 *
 * Transcribed 2026-09-30 from the server-rendered `.text-page-content .text` of
 * each page. Measured template: the same two-column sticky as /about —
 * `.text-page-title` (h1 + "Last updated:" line + hr) and `.text-page-content`.
 * Terms has 13 numbered H2s, Privacy 10 numbered H2s, Cookies 5 H2s with H3
 * sub-sections and ordered lists.
 *
 * Reproducing the wording of a public policy page is a fidelity decision of this
 * clone; it does not make the local build a party to it — see LEGAL_DISCLAIMER.
 */

export type LegalBlockType = 'p' | 'h2' | 'h3' | 'li' | 'steps' | 'help';

export interface LegalBlock {
  t: LegalBlockType;
  x: string;
  /** `steps` blocks carry the ordered-list items. */
  items?: readonly string[];
}

export interface LegalDoc {
  key: 'terms-and-conditions' | 'privacy-policy' | 'cookies-policy';
  path: string;
  title: string;
  /** Measured `document.title`. */
  documentTitle: string;
  lastUpdated: string;
  blocks: readonly LegalBlock[];
}

const TERMS: readonly LegalBlock[] = [
  { t: 'p', x: 'Welcome to FOLLOW.ART - a new-generation platform where artists and curators can thrive, connect, and grow professionally. Whether you\'re here to learn professional representation, showcase your work, expand your network, share knowledge, or discover innovative tools for your creative journey, FOLLOW.ART is your space to make it happen.' },
  { t: 'p', x: 'Through the FOLLOW.ART platform, you can choose how you want to represent yourself - from a free account to enhanced subscription features. At the heart of our ecosystem is the Card, your dynamic digital portfolio and networking tool that seamlessly connects you with opportunities and fellow creatives.' },
  { t: 'p', x: 'By using FOLLOW.ART, you\'re joining a community committed to making the art industry more accessible and creator-driven. These Terms & Conditions outline how we can work together to maintain this vibrant space, where we choose collaboration over competition. They\'re designed to protect both you and our community, ensuring everyone can focus on what matters most - creating, curating, connecting, and growing professionally.' },
  { t: 'p', x: 'Ready to begin? Let\'s transform how the art industry works - together. By using our platform, you\'re agreeing to these Terms - it\'s that simple.' },
  { t: 'p', x: 'Note: If you\'d prefer not to accept these terms, we understand. You\'ll need to hold off on using the platform for now.' },
  { t: 'h2', x: '1. What We\'re Building Together' },
  { t: 'p', x: 'FOLLOW.ART is your digital home for professional representation and creative growth. We provide a platform where you can:' },
  { t: 'li', x: 'Showcase your work and content your way' },
  { t: 'li', x: 'Find and connect with fellow curators and artists' },
  { t: 'li', x: 'Increase your income through contributions from your supporters' },
  { t: 'li', x: 'Access powerful digital tools that enhance your professional representation' },
  { t: 'li', x: 'Use the Card to expand your professional network seamlessly across the world' },
  { t: 'h2', x: '2. Your Journey With Us' },
  { t: 'p', x: 'Whether you\'re starting with our free features or choosing a paid subscription or add-on features, you\'re in control of your creative journey. Each subscription level offers different tools and possibilities to support your professional representation and connections.' },
  { t: 'h2', x: '3. Our Commitment to Change' },
  { t: 'p', x: 'The art world is evolving, and so are we. When we make important changes to these Terms, we\'ll let you know 30 days in advance. We\'ll keep you updated through email or platform notifications, ensuring you\'re always informed about how these changes might affect you.' },
  { t: 'h2', x: '4. Your Space on FOLLOW.ART' },
  { t: 'p', x: 'You\'re welcome to join if you:' },
  { t: 'li', x: 'Are an artist and/or curator 18 years old or older' },
  { t: 'li', x: 'Share authentic information about yourself' },
  { t: 'li', x: 'Keep your account secure' },
  { t: 'p', x: 'We value authenticity in our community. That\'s why we may need to restrict accounts that misrepresent themselves or engage in fraudulent activities.' },
  { t: 'p', x: 'Your FOLLOW.ART Name Your creative identity matters. When joining FOLLOW.ART, you\'ll choose a Name that represents you while respecting our community standards and others\' rights.' },
  { t: 'p', x: 'Choose Wisely:' },
  { t: 'li', x: 'Your Name should authentically represent you or your creative practice' },
  { t: 'li', x: 'Avoid using names of others (like artists, curators, brands, or institutions) without authorization' },
  { t: 'li', x: 'Keep it professional and appropriate for our global creative community' },
  { t: 'li', x: 'Don\'t select Names just to sell them later (no domain squatting)' },
  { t: 'h2', x: '5. Your Creative Content' },
  { t: 'p', x: 'When sharing your content with us, you\'re confirming that:' },
  { t: 'li', x: 'It\'s your original content or you have the rights to share it' },
  { t: 'li', x: 'It respects others\' intellectual property and privacy' },
  { t: 'li', x: 'It aligns with legal requirements and professional standards' },
  { t: 'p', x: 'Your content deserves to be seen. When you share content on FOLLOW.ART, here\'s how we can help amplify your creative voice:' },
  { t: 'h2', x: '6. Growing Together: Plans & Payments' },
  { t: 'li', x: 'Start with a free account to explore our basic features' },
  { t: 'li', x: 'Upgrade to paid subscriptions for enhanced tools and opportunities' },
  { t: 'li', x: 'Choose when to start and stop - you\'re in control of your subscription' },
  { t: 'li', x: 'Subscriptions are billed upfront and auto-renew for your convenience' },
  { t: 'li', x: 'You can cancel anytime' },
  { t: 'li', x: 'Your access continues until the end of your billing period' },
  { t: 'li', x: 'FOLLOW.ART also offers a Support My Practice feature, allowing you to collect contributions from your supporters via the Card, powered by Stripe Connect.' },
  { t: 'li', x: 'By using this feature, you are solely responsible for managing any revenue received, including handling taxes, disputes, chargebacks, and any legal or financial obligations.' },
  { t: 'li', x: 'FOLLOW.ART acts only as a platform and does not process or manage payments directly. In some cases, FOLLOW.ART may collect a small commission from contributions received. All applicable fees and commission rates will be clearly communicated during the setup of this functionality and in the relevant support documentation on our website.' },
  { t: 'li', x: 'All applicable fees and terms are clearly communicated during your Stripe profile setup.' },
  { t: 'li', x: 'From time to time, FOLLOW.ART may offer promotional codes for discounts on subscription plans or features.' },
  { t: 'li', x: 'Promo codes are subject to expiration dates, usage limits, and other conditions as specified at the time of offer.' },
  { t: 'li', x: 'Promo codes are non-transferable, have no cash value, and may not be combined with other offers unless explicitly stated.' },
  { t: 'li', x: 'FOLLOW.ART may provide a referral program allowing users to earn rewards or benefits by inviting others to join the platform.' },
  { t: 'li', x: 'Participation in the referral program is subject to specific terms, including eligibility criteria and reward conditions, which will be disclosed within the referral interface or on our website.' },
  { t: 'li', x: 'FOLLOW.ART reserves the right to suspend or terminate referral rewards at its discretion if abuse, fraud, or violations of the terms are detected.' },
  { t: 'h2', x: '7. Community Standards' },
  { t: 'li', x: 'Be yourself - authentic profiles only' },
  { t: 'li', x: 'Share content that enriches yourself and our community' },
  { t: 'li', x: 'Engage genuinely - no automated tools or bots' },
  { t: 'li', x: 'Respect others - no harassment or spam' },
  { t: 'h2', x: '8. Feedback & Beta Features' },
  { t: 'p', x: 'Your insights help shape FOLLOW.ART! Here\'s how we collaborate to make our platform better:' },
  { t: 'li', x: 'We value your suggestions for improving FOLLOW.ART' },
  { t: 'li', x: 'Your feedback helps us create better tools for the creative community' },
  { t: 'li', x: 'When you share ideas with us, we can use them to enhance the platform' },
  { t: 'li', x: 'While we can\'t offer payment for suggestions, we deeply appreciate your input' },
  { t: 'h2', x: '9. Protecting Creativity' },
  { t: 'li', x: 'Your content stays yours' },
  { t: 'li', x: 'FOLLOW.ART\'s platform and branding belong to us' },
  { t: 'li', x: 'By sharing your work and other content here, you\'re allowing us to showcase it within FOLLOW.ART sources, including social media accounts' },
  { t: 'h2', x: '10. Being Transparent' },
  { t: 'li', x: 'FOLLOW.ART is evolving - we provide our platform as it is' },
  { t: 'li', x: 'While we strive for reliability, occasional interruptions might happen' },
  { t: 'li', x: 'We\'re responsible up to the amount of your paid subscription' },
  { t: 'li', x: 'Third-party services connected to FOLLOW.ART operate under their own terms' },
  { t: 'h2', x: '11. Pre-Launch Community' },
  { t: 'li', x: 'Be first to know about our launch' },
  { t: 'li', x: 'Receive updates about new features' },
  { t: 'li', x: 'Get special announcements' },
  { t: 'li', x: 'Have the option to unsubscribe anytime' },
  { t: 'h2', x: '12. Legal Framework' },
  { t: 'li', x: 'These Terms are governed by the laws of Latvia' },
  { t: 'li', x: 'When using FOLLOW.ART, you agree to the jurisdiction of Latvian courts' },
  { t: 'li', x: 'If local laws in your region conflict with these Terms, those laws will take precedence' },
  { t: 'li', x: 'We comply with EU data protection regulations and consumer rights' },
  { t: 'h2', x: '13. Staying Connected' },
  { t: 'p', x: 'Questions? Ideas? We\'re all ears at help@follow.art.' },
  { t: 'p', x: 'Address: Bikernieku str 22, Riga LV-1006, Latvia, FOLLOW.ART Ltd Reg.No: 42103112628 VAT No: LV42103112628' },
] as const;

const PRIVACY: readonly LegalBlock[] = [
  { t: 'p', x: 'Welcome to follow.art!' },
  { t: 'p', x: 'At follow.art, we prioritize your privacy. We understand the importance of your personal data and are committed to being transparent about how we collect, use, and protect it. Whether you’re a visual artist, curator, or part of the broader art community, we want you to feel confident and secure while using our services. This Privacy Policy is designed to clearly explain how we handle your data, so you can trust us every step of the way.' },
  { t: 'p', x: 'Our solution is designed to help you connect, collaborate, and thrive within the global art community and beyond. Whether you’re an artist, curator, or creative professional, our tools are here to support your journey. As we work to bring these resources to you, protecting your privacy remains our top priority. That’s why we’ve carefully crafted this policy to meet global data protection standards, so you can focus on what you do best—creating and inspiring—while feeling safe and empowered every step of the way.' },
  { t: 'h2', x: '1. Information We Collect' },
  { t: 'p', x: 'We collect various types of information, including:' },
  { t: 'li', x: 'Personal Identification Information: Name, email address, phone number, your role in the art industry, and other information you provide to us.' },
  { t: 'li', x: 'Technical Data: Information about your device, browsing patterns, IP address, and usage of the follow.art platform.' },
  { t: 'li', x: 'Usage Data: Information about your interactions with the platform, such as actions taken, content viewed, and preferences.' },
  { t: 'h2', x: '2. How We Use Your Information' },
  { t: 'p', x: 'We use your information for various purposes, including:' },
  { t: 'li', x: 'Providing Services: To enable access to follow.art features, including the creation of accounts, content sharing, and communication with other users.' },
  { t: 'li', x: 'Improving User Experience: To personalize and improve the platform based on usage patterns and feedback.' },
  { t: 'li', x: 'Marketing and Promotions: To inform you about new features, products, services, or events that may interest you.' },
  { t: 'li', x: 'Compliance and Legal Obligations: To comply with legal requirements and obligations under applicable laws.' },
  { t: 'h2', x: '3. How We Share Your Information' },
  { t: 'p', x: 'We may share your information in the following circumstances:' },
  { t: 'li', x: 'Service Providers: With third-party vendors who assist us in operating the platform, providing services, and performing business functions.' },
  { t: 'li', x: 'Legal Compliance: If required by law or in response to valid legal requests, including complying with legal processes.' },
  { t: 'li', x: 'Business Transfers: In connection with mergers, acquisitions, or sales of our assets.' },
  { t: 'h2', x: '4. Data Retention' },
  { t: 'p', x: 'We retain your personal data only for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required by law.' },
  { t: 'h2', x: '5. Your Rights' },
  { t: 'p', x: 'Depending on your jurisdiction, you may have the right to:' },
  { t: 'li', x: 'Access: Request copies of your personal data.' },
  { t: 'li', x: 'Correction: Request corrections to your personal data.' },
  { t: 'li', x: 'Deletion: Request the deletion of your personal data.' },
  { t: 'li', x: 'Restriction: Request restrictions on how we process your personal data.' },
  { t: 'li', x: 'Object: Object to the processing of your personal data.' },
  { t: 'p', x: 'To exercise these rights, please contact us at the email provided in Section 9.' },
  { t: 'h2', x: '6. Security of Your Data' },
  { t: 'p', x: 'We implement appropriate technical and organizational measures to protect your personal data from unauthorized access, loss, or destruction.' },
  { t: 'h2', x: '7. International Data Transfers' },
  { t: 'p', x: 'As follow.art operates globally, your personal data may be transferred and stored outside of your country of residence. By using our services, you consent to the transfer of your data to locations outside your jurisdiction, which may have different data protection laws.' },
  { t: 'h2', x: '8. Cookies and Tracking Technologies' },
  { t: 'p', x: 'We use cookies and similar tracking technologies to enhance user experience, analyze usage patterns, and provide personalized content. You can manage your cookie preferences through your browser settings.' },
  { t: 'h2', x: '9. Contact Information' },
  { t: 'p', x: 'If you have any questions about this Privacy Policy or our data practices, please contact us at:' },
  { t: 'p', x: 'Email: help@follow.art. Address: Riga, Bikernieku str.22, Latvia, LV-1006.' },
  { t: 'h2', x: '10. Updates to This Privacy Policy' },
  { t: 'p', x: 'We may update this Privacy Policy from time to time. When we make changes, we will update the “Last updated” date at the top of this document. We encourage you to review this Privacy Policy periodically to stay informed about how we are protecting your information.' },
] as const;

const COOKIES: readonly LegalBlock[] = [
  { t: 'h2', x: 'What are cookies exactly?' },
  { t: 'p', x: 'Cookies are small text files that our website stores on your computer or mobile device when you visit follow.art. These files contain information that can be read by our website during subsequent visits. Each website can only access its own cookies, though some pages may contain elements (and therefore cookies) from multiple sources.' },
  { t: 'h2', x: 'Why do we use cookies?' },
  { t: 'p', x: 'At follow.art, we use cookies to:' },
  { t: 'li', x: 'Provide you with a consistent and personalized browsing experience.' },
  { t: 'li', x: 'Remember your preferences and settings.' },
  { t: 'li', x: 'Keep you authenticated when you log into your account.' },
  { t: 'li', x: 'Analyze how visitors use our website to improve our services.' },
  { t: 'li', x: 'Enable essential features like shopping carts and wishlists.' },
  { t: 'h2', x: 'What types of cookies do we use?' },
  { t: 'h3', x: 'Analytics Cookies' },
  { t: 'p', x: 'We use Google Analytics cookies to understand how visitors interact with our website. These anonymous cookies help us:' },
  { t: 'li', x: 'Track unique visitor counts.' },
  { t: 'li', x: 'Identify the most popular pages.' },
  { t: 'li', x: 'Understand user behavior patterns.' },
  { t: 'li', x: 'Gather geographical data about our visitors.' },
  { t: 'li', x: 'Make data-driven decisions to improve our service.' },
  { t: 'h3', x: 'Authentication Cookies' },
  { t: 'p', x: 'When you log into your follow.art account, we create authentication cookies to:' },
  { t: 'li', x: 'Keep you signed in.' },
  { t: 'li', x: 'Protect your account security.' },
  { t: 'li', x: 'Verify your access permissions.' },
  { t: 'li', x: 'Manage your session state.' },
  { t: 'p', x: 'These cookies typically expire when you close your browser or shut down your device.' },
  { t: 'h3', x: 'Marketing Cookies' },
  { t: 'p', x: 'We use marketing cookies to:' },
  { t: 'li', x: 'Track the effectiveness of our advertising campaigns.' },
  { t: 'li', x: 'Enable retargeting through platforms like Google and Facebook.' },
  { t: 'li', x: 'Control ad displays for visitors who have been to our site.' },
  { t: 'li', x: 'Optimize our marketing spend.' },
  { t: 'p', x: 'No personal information is shared with advertisers through these cookies.' },
  { t: 'h3', x: 'Site Display Cookies' },
  { t: 'p', x: 'These cookies remember your preferences for:' },
  { t: 'li', x: 'Page display settings.' },
  { t: 'li', x: 'Interface customizations.' },
  { t: 'li', x: 'Dismissed notifications.' },
  { t: 'li', x: 'Accessibility options.' },
  { t: 'h3', x: 'Shopping Cart & Wishlist Cookies' },
  { t: 'p', x: 'We use these cookies to:' },
  { t: 'li', x: 'Maintain your shopping cart contents.' },
  { t: 'li', x: 'Save items to your wishlist.' },
  { t: 'li', x: 'Provide a seamless shopping experience.' },
  { t: 'li', x: 'Enable guest checkout functionality.' },
  { t: 'h2', x: 'How do I turn cookies off?' },
  { t: 'p', x: 'While cookies help enhance your experience on follow.art, you can disable them through your browser settings. Here\'s how to manage cookies in popular browsers:' },
  { t: 'h3', x: 'Firefox' },
  { t: 'steps', x: '', items: ['Open the Tools menu.', 'Select Options.', 'Click Privacy.', 'Adjust cookie settings as desired.'] },
  { t: 'help', x: 'For detailed instructions, visit Firefox Cookie Settings Help' },
  { t: 'h3', x: 'Chrome' },
  { t: 'steps', x: '', items: ['Click the menu icon (three dots).', 'Select Settings.', 'Click "Privacy and security."', 'Choose "Cookies and other site data."'] },
  { t: 'help', x: 'For detailed instructions, visit Chrome Cookie Settings Help.' },
  { t: 'h3', x: 'Safari' },
  { t: 'steps', x: '', items: ['Open Safari Preferences.', 'Click the Privacy tab.', 'Adjust cookie settings as needed.'] },
  { t: 'help', x: 'For detailed instructions, visit Safari Cookie Settings Help.' },
  { t: 'h3', x: 'Internet Explorer' },
  { t: 'steps', x: '', items: ['Open the Tools menu.', 'Select Internet Options.', 'Click the Privacy tab.', 'Adjust cookie settings as desired.'] },
  { t: 'help', x: 'For detailed instructions, visit Internet Explorer Cookie Settings Help.' },
  { t: 'p', x: 'Please Note: Disabling cookies may limit your ability to use certain features of follow.art, including:' },
  { t: 'li', x: 'Account login' },
  { t: 'li', x: 'Shopping cart functionality' },
  { t: 'li', x: 'Personalized experiences' },
  { t: 'li', x: 'Saved preferences' },
  { t: 'li', x: 'Access to restricted content' },
  { t: 'h2', x: 'Questions?' },
  { t: 'p', x: 'If you have any questions about our use of cookies or this policy, please contact us at help@follow.art' },
] as const;

export const LEGAL_DOCS: Readonly<Record<LegalDoc['key'], LegalDoc>> = {
  'terms-and-conditions': {
    key: 'terms-and-conditions',
    path: '/terms-and-conditions',
    title: 'Terms & Conditions',
    documentTitle: 'Terms & Conditions | FOLLOW.ART',
    lastUpdated: 'Last updated: February 5th, 2025',
    blocks: TERMS,
  },
  'privacy-policy': {
    key: 'privacy-policy',
    path: '/privacy-policy',
    title: 'Privacy Policy',
    documentTitle: 'Privacy Policy | FOLLOW.ART',
    lastUpdated: 'Last updated: February 5th, 2025',
    blocks: PRIVACY,
  },
  'cookies-policy': {
    key: 'cookies-policy',
    path: '/cookies-policy',
    title: 'Cookies Policy',
    /* Measured: the page's own h1 says "Cookies Policy" although the footer
       label and the route say "Cookie Policy". */
    documentTitle: 'Privacy Policy | FOLLOW.ART',
    lastUpdated: 'Last updated: February 5th, 2025',
    blocks: COOKIES,
  },
};

/**
 * Clone-local statement (not reference copy): what this build actually does.
 */
export const LEGAL_DISCLAIMER: readonly string[] = [
  'Local clone build: this page is a static reproduction for a course assignment. It is not the service described above.',
  'It issues no network requests, loads no analytics, advertising or error-reporting scripts, and stores no credentials or personal data.',
  'The `help@follow.art` and browser-help links shown on the reference are rendered as inert text here, because following them would leave this offline build.',
] as const;
