/**
 * faq.ts — /faq, transcribed from the server-rendered answer text of
 * https://follow.art/faq (captured 2026-09-30 through the in-app browser).
 *
 * Measured accordion contract (verified by clicking in the live page):
 *   • one `<button class="faq-section__card-list-item-header" aria-expanded
 *     aria-controls>` per SUB-GROUP (19 of them);
 *   • the questions inside a sub-group are plain `<h3>` + answer `<div>`; they are
 *     NOT individually collapsible, so only the sub-group toggles;
 *   • behaviour is MULTI-open: opening "Connectory" leaves "Getting Started" open;
 *   • the region is `role="region" aria-labelledby="<button id>"`.
 *
 * Answer text is mini-markdown, parsed at render time by src/pages/RichText.vue:
 *   **bold**   -> <b>
 *   [t](/href) -> internal link
 *   "- " block -> <li> (consecutive items collapse into one <ul>)
 *   "[EUR]"    -> replaced by FAQ_PRICE_LINES from ./pricing (single price source)
 */
import { FAQ_PRICE_LINES } from './pricing';

export interface FaqQuestion {
  question: string;
  /** Mini-markdown blocks of `.faq-section__faq-step-content`. */
  answer: readonly string[];
}

export interface FaqSubGroup {
  /** `id` of the region; the button id is this plus "-button". */
  regionId: string;
  label: string;
  /** `true`  -> `…-internal-list--with-counter`, `false` -> plain list. */
  numbered: boolean;
  questions: readonly FaqQuestion[];
}

export interface FaqGroup {
  title: string;
  subGroups: readonly FaqSubGroup[];
}

const PRICING_LINES = FAQ_PRICE_LINES;

export const FAQ_GROUPS: readonly FaqGroup[] = [
  {
    title: 'For Artists',
    subGroups: [
      {
        regionId: 'artists-getting-started',
        label: 'Getting Started',
        numbered: true,
        questions: [
          {
            question: 'How do I get started on FOLLOW.ART?',
            answer: ['Go to [follow.art/signup](/signup) and create your account. It takes a minute to sign up and a few more to set up your **FOLLOW.ART Card**.'],
          },
          {
            question: 'What types of artists can join FOLLOW.ART?',
            answer: ['Artists working across traditional, contemporary, digital, experimental and interdisciplinary media are welcome. You can join at any stage of your career.'],
          },
          {
            question: 'Do I need to be 18 to join FOLLOW.ART?',
            answer: ['Yes. You must be 18 or older to create an account.'],
          },
        ],
      },
      {
        regionId: 'artists-follow.art-card',
        label: 'FOLLOW.ART Card',
        numbered: true,
        questions: [
          {
            question: 'What is the FOLLOW.ART Card?',
            answer: [
              'The [FOLLOW.ART Card](/our-product) is a centralized digital portfolio for artists. It brings your artworks, contact details, links and support options into one clear, shareable place.',
              'People can access your practice via link or QR scan.',
            ],
          },
          {
            question: 'Why should I use the FOLLOW.ART Card?',
            answer: [
              'The Card helps you present your work clearly, share easily and stay connected after real life meetings, exhibitions, studio visits, art fairs and other events.',
              'It works like a portfolio and a business card in one. It is cheaper and easier to maintain than a website, more focused and professional than social media and easier to update than a PDF.',
            ],
          },
          {
            question: 'Is the FOLLOW.ART Card free?',
            answer: [
              'Yes. Artists can create a free FOLLOW.ART Card.',
              'The **PRO plan** gives access to expanded features, including more portfolio space, profile statistics, Support My Practice feature to receive audience support, QR code generation, studio visit booking options and other tools for professional visibility.',
              'Current PRO pricing is:',
              ...PRICING_LINES,
              'You can find the full details at [follow.art/pricing](/pricing).',
            ],
          },
          {
            question: 'What information can I include in my Card?',
            answer: ['You can include the key information people need to understand and contact you: practice focus, bio, portfolio, artwork details, links, social media and contact options.'],
          },
          {
            question: 'Can I sell art directly through my Card?',
            answer: ['Not directly through FOLLOW.ART at the moment. You can show prices and link to your e-shop or marketplace so people can easily find and purchase your work.'],
          },
          {
            question: 'Is my Card a standalone profile or part of a wider platform?',
            answer: ['Both. Your Card works as a standalone digital portfolio that you can share anywhere. Once published, it also becomes part of the FOLLOW.ART Connectory, where artists and curators can be discovered without algorithms or posting pressure.'],
          },
          {
            question: 'How do I make the most out of my Card?',
            answer: ['Keep your Card updated with recent works, projects and links. The clearer your Card is, the easier it is for people to understand, remember and support your practice. Add your Card to your mobile wallet so you can share it quickly during in-person meetings, studio visits, exhibitions and art fairs. Add the link to your email signature, social media bio and other online channels. At events, use a QR code that leads to your Card. Place it near your works, on labels or printed materials, so visitors have one clear place to access your practice and revisit it after the event.'],
          },
        ],
      },
      {
        regionId: 'artists-connectory',
        label: 'Connectory',
        numbered: true,
        questions: [
          {
            question: 'What is the Connectory?',
            answer: ['The Connectory is the FOLLOW.ART directory for artists and curators. It helps members discover each other through filters such as location, themes, medium and experience.'],
          },
          {
            question: 'How does the Connectory help me connect?',
            answer: ['Your published Card makes you searchable inside the Connectory. Other members can find your practice, save your profile and contact you directly through the information you choose to share.'],
          },
          {
            question: 'How does the Connectory promote my work?',
            answer: [
              'The Connectory gives your Card a stable place inside a professional network. Your visibility is not based on posting frequency, follower counts or algorithms.',
              'You can also use the Community Board to share updates, open calls, collaboration ideas and questions.',
            ],
          },
          {
            question: 'How do I reach out to others?',
            answer: ['You can save profiles that interest you and contact members through their shared details. You can also respond to Community Board posts and start conversations there.'],
          },
        ],
      },
    ],
  },
  {
    title: 'For Curators',
    subGroups: [
      {
        regionId: 'curators-getting-started',
        label: 'Getting Started',
        numbered: true,
        questions: [
          {
            question: 'How do I get started on FOLLOW.ART?',
            answer: ['Go to [follow.art/signup](/signup) and create your account. It takes a minute to sign up and a few more to set up your **FOLLOW.ART Card**.'],
          },
          {
            question: 'Who can join as a curator?',
            answer: ['Curators working across contemporary art, historical research, public programs, experimental formats, education and independent projects are welcome. You can join at any stage of your career.'],
          },
          {
            question: 'Do I need to be 18 to join?',
            answer: ['Yes. You must be 18 or older to create an account.'],
          },
        ],
      },
      {
        regionId: 'curators-follow.art-card',
        label: 'FOLLOW.ART Card',
        numbered: true,
        questions: [
          {
            question: 'What is the FOLLOW.ART Card for curators?',
            answer: [
              'The [FOLLOW.ART Card](/our-product) is a centralized digital portfolio for curators. It brings your curatorial practice, projects, research, experience, links and contact details into one focused format.',
              'It helps you present clearly, share easily and be found by artists, peers, institutions and potential collaborators.',
            ],
          },
          {
            question: 'Why should curators use the FOLLOW.ART Card?',
            answer: [
              'Curatorial work is often scattered across websites, PDFs, social media, exhibition texts and institutional pages. The Card gives your practice one clear point of access.',
              'You can use it in proposals, panels, studio visits, openings, networking moments and public programs.',
            ],
          },
          {
            question: 'Is the FOLLOW.ART Card free for curators?',
            answer: [
              'Yes. Curators can create a free FOLLOW.ART Card.',
              'The **PRO plan** gives access to expanded features, including more project space, Support My Practice feature to receive audience support, meeting booking options, QR code generation, profile statistics and other tools.',
              'Current PRO pricing is:',
              ...PRICING_LINES,
              'You can find the full details at [follow.art/pricing](/pricing).',
            ],
          },
          {
            question: 'What information can I add to my Card?',
            answer: ['You can add your curatorial focus, bio, projects and research, exhibitions, links, social media and contact details.'],
          },
          {
            question: 'Is my Card a standalone profile or part of a wider platform?',
            answer: ['Both. Your Card works as a standalone digital portfolio that you can share anywhere. Once published, it also becomes part of the FOLLOW.ART Connectory, where curators and artists can be discovered without algorithms or posting pressure.'],
          },
          {
            question: 'How do I make the most out of my Card?',
            answer: ['Keep your Card updated with recent information, projects and links. The clearer your Card is, the easier it is for people to understand, remember and support your practice. Add your Card to your mobile wallet so you can share it quickly during in-person meetings, studio visits, exhibitions and other events. Add the link to your email signature, social media bio and other online channels. At your curated projects, use a QR code that leads to your Card. Place it in the space and on printed materials, so visitors have one clear place to access your practice and revisit it after the event.'],
          },
        ],
      },
      {
        regionId: 'curators-connectory',
        label: 'Connectory',
        numbered: true,
        questions: [
          {
            question: 'How does the Connectory help curators?',
            answer: ['The Connectory helps curators find artists, connect with peers and build professional relationships. You can search by medium, themes, location, experience and other filters, then save profiles and reach out directly.'],
          },
          {
            question: 'How can I connect with artists?',
            answer: [
              'You can search the Connectory, save profiles that interest you and contact others through the details they choose to share.',
              'You can also use the Community Board to post open calls, ask questions, share opportunities or start conversations around curatorial work.',
            ],
          },
          {
            question: 'Can curators connect with other curators?',
            answer: ['Yes. Curators can use Connectory to find peers that work with similar themes to exchange knowledge, share opportunities and collaborate.'],
          },
        ],
      },
    ],
  },
  {
    title: 'Support My Practice',
    subGroups: [
      {
        regionId: 'what-is-support-my-practice',
        label: 'What is Support My Practice?',
        numbered: true,
        questions: [
          {
            question: 'What is Support My Practice?',
            answer: [
              'Support My Practice is a micro-patronage feature that allows people to support artists and curators financially through their FOLLOW.ART Card.',
              'It gives exhibition visitors, peers, friends, collectors and the general public a direct way to contribute to artistic and curatorial work.',
            ],
          },
          {
            question: 'How does Support My Practice work?',
            answer: [
              '- You activate Support My Practice on your Card.',
              '- Supporters choose an amount.',
              '- Payments are processed securely through Stripe.',
              '- Funds go directly to your connected bank account. Allow a few working days for the amount to appear on your balance.',
              '- Only standard Stripe processing fees apply.',
              '- Supporters can choose to share their email address with you or stay anonymous.',
              '- If you receive a supporter’s email, you’re welcome to engage by sending a ‘thank you’ note, invite them to studio visits, exhibitions and keep them updated about your work.',
            ],
          },
          {
            question: 'Does FOLLOW.ART take a commission?',
            answer: ['No. FOLLOW.ART does not take a commission from contributions. You receive 100% of the contribution, excluding Stripe processing fees.'],
          },
          {
            question: 'Who is Support My Practice for?',
            answer: ['Support My Practice is for artists and curators. It is especially useful in contexts where people value the work but are not buying an artwork directly, such as exhibitions, studio visits, talks, public programs, research projects and independent curatorial initiatives.'],
          },
          {
            question: 'Is Support My Practice only for artists?',
            answer: ['No. Support My Practice is very useful for curators too. It can help make curatorial research, independent work and behind the scenes labour more visible and supportable.'],
          },
        ],
      },
    ],
  },
  {
    title: 'What’s Unique About FOLLOW.ART',
    subGroups: [
      {
        regionId: 'infrastructure-for-curators-and-artists',
        label: 'Infrastructure for curators and artists',
        numbered: true,
        questions: [
          {
            question: 'What is FOLLOW.ART?',
            answer: [
              'FOLLOW.ART is digital infrastructure for curators and artists.',
              'Its core product is the [FOLLOW.ART Card](/our-product), a digital portfolio that helps artists and curators centralize their practice, present it clearly, share it instantly and receive direct financial support.',
            ],
          },
          {
            question: 'Why is FOLLOW.ART better than a website or social media for artists and curators?',
            answer: [
              'The FOLLOW.ART Card is built for the moments when someone wants to understand your practice quickly and stay connected.',
              'Instead of sending people through outdated PDFs, isolated websites or social media feeds, you give them one clear place with your work, bio, contact details, links and support option.',
              'You can update the Card in minutes, share it instantly from your phone, use it at exhibitions, art fairs, studio visits, talks and meetings, and let people save your details or support your practice directly.',
              'One Card. One link. One scan. Everything people need to follow up.',
            ],
          },
          {
            question: 'Is FOLLOW.ART a marketplace?',
            answer: [
              'No. FOLLOW.ART is not a traditional marketplace. It does not focus on selling artworks through the platform.',
              'Instead, it helps artists and curators present their practice, build professional relationships and create direct support around their work.',
            ],
          },
          {
            question: 'Does FOLLOW.ART use algorithms to rank users?',
            answer: ['No. FOLLOW.ART does not use algorithms to rank or promote users. The Connectory is based on searchable information, filters and direct discovery.'],
          },
        ],
      },
      {
        regionId: 'referral-program',
        label: 'Referral Program',
        numbered: true,
        questions: [
          {
            question: 'Does FOLLOW.ART have a referral program?',
            answer: ['Yes. Every member has a unique referral link in their account.'],
          },
          {
            question: 'How does the referral program work?',
            answer: [
              'When someone joins FOLLOW.ART through your referral link, they receive 1 month of PRO access.',
              'When 3 people join through your referral link, you receive 3 months of free usage. If you already have a PRO plan, the 3 months are added to your next billing cycle.',
              'Full referral terms are available inside your account.',
            ],
          },
        ],
      },
      {
        regionId: 'gift-card',
        label: 'Gift Card',
        numbered: true,
        questions: [
          {
            question: 'What is a FOLLOW.ART Gift Card?',
            answer: ['A FOLLOW.ART Gift Card gives an artist or curator 12 months of PRO access.'],
          },
          {
            question: 'Why is it a good gift for an artist or curator?',
            answer: [
              'Artists and curators are often difficult to buy gifts for. A FOLLOW.ART Gift Card gives them practical benefits: better visibility, dedicated space to present their practice and access to tools that support professional growth.',
              'It can be used for birthdays, graduations, exhibition openings, career milestones or as a direct gesture of support.',
            ],
          },
          {
            question: 'Who can give a Gift Card?',
            answer: ['Anyone can give a Gift Card: friends, family, collectors, institutions, partners, mentors or supporters. You do not need to be a FOLLOW.ART member to purchase one.'],
          },
          {
            question: 'How does it work?',
            answer: ['After purchase, the recipient receives instructions to activate 12 months of PRO access.'],
          },
          {
            question: 'Where can I purchase one?',
            answer: ['Visit [follow.art/gift-card](/gift-card).'],
          },
        ],
      },
      {
        regionId: 'collaborations-and-partnerships',
        label: 'Collaborations and Partnerships',
        numbered: true,
        questions: [
          {
            question: 'How can I become a FOLLOW.ART Ambassador?',
            answer: [
              'FOLLOW.ART works with artists and curators who want to help shape better digital infrastructure for the art field. Ambassadors support the platform through feedback, community building, events, content or local activations.',
              '[Learn more here.](https://drive.google.com/file/d/1munFJxY8kywtxZgDybGpAle5j_GeMHF-/view?usp=sharing)',
            ],
          },
          {
            question: 'Can FOLLOW.ART host a workshop in my city or institution?',
            answer: ['Yes. FOLLOW.ART runs workshops on professional presentation, networking, digital visibility, artist and curator careers, and practical use of the Card in real life contexts.'],
          },
          {
            question: 'Can I invite FOLLOW.ART to a panel or event?',
            answer: [
              'Yes. FOLLOW.ART can contribute to panels, talks and workshops about art and technology, artist support, curatorial infrastructure, digital visibility, creative economy and audience engagement.',
              'You can view the [Speaker Kit.](https://drive.google.com/file/d/16WnkqjLCqNUOP-e-JGHozXrqLv5-NdtV/view)',
            ],
          },
          {
            question: 'Can my organisation sponsor FOLLOW.ART programs or events?',
            answer: ['Yes. FOLLOW.ART is open to sponsorships for workshops, webinars, professional development programs and on site events for artists and curators.'],
          },
          {
            question: 'Can we suggest another type of collaboration?',
            answer: ['Yes. FOLLOW.ART is open to partnerships with institutions, art fairs, galleries, schools, media platforms, cultural organisations and independent initiatives.'],
          },
        ],
      },
      {
        regionId: 'community-standards',
        label: 'Community Standards',
        /* Measured: this sub-group has NO questions, it is one plain list item
           holding prose + a bulleted list, so `numbered` is false. */
        numbered: false,
        questions: [
          {
            question: '',
            answer: [
              'FOLLOW.ART is built around professional respect and shared mission to support the workflows of artists and curators.',
              'We expect our members to:',
              '- Share honestly and represent their practice clearly.',
              '- Respect the work, time and boundaries of others.',
              '- Ask before sharing someone else’s work or personal information.',
              '- Avoid harassment, hate speech, spam or misleading content.',
              '- Use the platform to build real professional relationships.',
              '- Turn online conversations into meaningful contact, collaboration or support where possible.',
            ],
          },
        ],
      },
      {
        regionId: 'engagement-and-growth',
        label: 'Engagement and Growth',
        numbered: true,
        questions: [
          {
            question: 'Does FOLLOW.ART offer guidance?',
            answer: ['Yes. FOLLOW.ART shares practical guidance through editorial content, interviews, newsletters, workshops and Community Board updates. Topics include self presentation, networking, artist and curator careers, studio visits, public engagement, fundraising and professional visibility.'],
          },
          {
            question: 'How do I stay updated?',
            answer: ['Subscribe to the FOLLOW.ART newsletter and check the Community Board for product updates, opportunities, events and member announcements.'],
          },
          {
            question: 'What are beta features?',
            answer: ['Beta features are new tools that FOLLOW.ART is still testing. They may be available to selected users before public release.'],
          },
          {
            question: 'What if I access beta features?',
            answer: ['If you receive early access to beta features, please keep details confidential unless FOLLOW.ART says otherwise. Feedback helps improve the tools before launch.'],
          },
        ],
      },
    ],
  },
  {
    title: 'Account Management and Legal Framework',
    subGroups: [
      {
        regionId: 'username-and-identity',
        label: 'Username and Identity',
        numbered: true,
        questions: [
          {
            question: 'Can I change my username later?',
            answer: ['Choose your username carefully. It should represent your artistic or curatorial identity. FOLLOW.ART may help with changes in special cases, but usernames are intended to remain stable.'],
          },
          {
            question: 'What happens if my account is inactive?',
            answer: ['If you do not log in or update your account for more than 6 months, your username may be reassigned. FOLLOW.ART will contact you first.'],
          },
          {
            question: 'What if someone uses a name similar to mine?',
            answer: ['Please avoid using names that could be confused with another artist, curator, brand or institution. If you notice a conflict, contact FOLLOW.ART and the team will review the situation.'],
          },
        ],
      },
      {
        regionId: 'content-and-rights',
        label: 'Content and Rights',
        numbered: true,
        questions: [
          {
            question: 'Who owns the content I upload?',
            answer: [
              'You do. You keep ownership of your content.',
              'When you upload content to FOLLOW.ART, you give FOLLOW.ART permission to display it and, where relevant, feature it in communication that promotes the community. FOLLOW.ART does not sell your content.',
            ],
          },
          {
            question: 'Can FOLLOW.ART feature my work for promotion?',
            answer: ['Yes. FOLLOW.ART may feature member work to highlight the community and increase visibility. Credit will be given.'],
          },
          {
            question: 'How do I protect my work?',
            answer: ['Keep your own backups of original files. FOLLOW.ART is a presentation and networking tool, not a replacement for personal file storage.'],
          },
        ],
      },
      {
        regionId: 'subscriptions-and-pricing',
        label: 'Subscriptions and Pricing',
        numbered: true,
        questions: [
          {
            question: 'Where can I find pricing information?',
            answer: ['You can find all pricing details at [follow.art/pricing](/pricing).'],
          },
          {
            question: 'How much does FOLLOW.ART PRO cost?',
            answer: ['The PRO plan costs:', ...PRICING_LINES],
          },
          {
            question: 'Can I cancel anytime?',
            answer: ['Yes. You can cancel anytime. Your PRO access remains active until the end of your current billing cycle.'],
          },
          {
            question: 'Do you offer discounts or promo codes?',
            answer: [
              'Yes. FOLLOW.ART sometimes offers promo codes and partner discounts. These may have expiration dates, usage limits and conditions. Promo codes are not transferable, have no cash value and cannot be combined unless stated.',
              'You can check the PROMO section on [follow.art/pricing](/pricing) and look out for email updates.',
            ],
          },
        ],
      },
      {
        regionId: 'trust-and-security',
        label: 'Trust and Security',
        numbered: true,
        questions: [
          {
            question: 'How does FOLLOW.ART handle my data?',
            answer: [
              'FOLLOW.ART does not sell your data. You control what you share on your Card and profile.',
              'FOLLOW.ART complies with EU data protection regulations, including GDPR.',
            ],
          },
          {
            question: 'Does FOLLOW.ART use my data to rank or promote me through algorithms?',
            answer: ['No. FOLLOW.ART does not use algorithms to rank, boost or suppress members. Visibility inside the Connectory is based on searchable profile information and filters.'],
          },
        ],
      },
      {
        regionId: 'legal-and-company-information',
        label: 'Legal and Company Information',
        numbered: true,
        questions: [
          {
            question: 'What laws govern FOLLOW.ART?',
            answer: ['FOLLOW.ART operates under Latvian law. By using FOLLOW.ART, you agree to Latvian jurisdiction. FOLLOW.ART also complies with EU data protection and consumer rights regulations.'],
          },
          {
            question: 'How will I know about changes to the Terms?',
            answer: ['FOLLOW.ART will notify users 30 days before changes through email.'],
          },
          {
            question: 'Where is FOLLOW.ART based?',
            answer: [
              'FOLLOW.ART Ltd is registered in Latvia:',
              'Bikernieku str. 22, Riga, Latvia, LV-1006',
              'Reg. No: 42103112628',
              'VAT No: LV42103112628',
            ],
          },
          {
            question: 'Who is behind FOLLOW.ART?',
            answer: [
              'FOLLOW.ART is built by an international team bringing together experience in curating, technology, event production, and communications. We are committed to supporting artistic and curatorial work as a vital foundation of the art field. This commitment shapes the partnerships we are growing with institutions, brands and media.',
              '[Learn more about us](/about).',
            ],
          },
        ],
      },
      {
        regionId: 'still-have-questions',
        label: 'Still Have Questions',
        numbered: false,
        questions: [
          {
            /* Measured as a list entry whose title is "Email", not a question. */
            question: 'Email',
            answer: ['[help@follow.art](mailto:help@follow.art)'],
          },
        ],
      },
    ],
  },
] as const;

export const FAQ_PAGE = {
  path: '/faq',
  theme: 'light',
  heading: 'FAQ',
  /** `.faq-section__description`, verbatim (the reference obfuscates the address). */
  description: 'Need to talk through something specific? Reach out anytime at help@follow.art',
  descriptionLink: 'mailto:help@follow.art',
  /** `.faq-section__title-decoration` srcs — not captured into public/, see report. */
  titleDecorations: [
    { reference: '/images/common/question-mark.svg', local: null },
    { reference: '/images/common/exclamation-mark.svg', local: null },
  ] as const,
} as const;

export function faqQuestionCount(): number {
  return FAQ_GROUPS.reduce(
    (groups, group) =>
      groups + group.subGroups.reduce((sum, sub) => sum + sub.questions.length, 0),
    0,
  );
}
