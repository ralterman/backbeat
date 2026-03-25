export const metadata = {
  title: "Privacy Policy — Backbeat",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] px-6 py-16">
      <div className="max-w-[800px] mx-auto">
        <h1 className="text-3xl font-bold mb-1" style={{ color: "#C8A96E" }}>Privacy Policy</h1>
        <p className="text-sm text-[#9090aa] mb-10">Effective Date: March 25, 2026</p>

        <Section title="1. Introduction">
          <p>Backbeat (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates the website backbeat.me and provides an AI-powered video music matching service (&ldquo;Service&rdquo;). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service. Please read this carefully. If you disagree with its terms, please discontinue use of the Service.</p>
        </Section>

        <Section title="2. Information We Collect">
          <Subheading>2.1 Information You Provide</Subheading>
          <ul>
            <li>Email address (when you sign up via magic link or Google OAuth)</li>
            <li>Videos you upload to the Service for analysis</li>
            <li>Payment information — note: we do not store credit card numbers directly; payments are processed by Stripe, Inc.</li>
            <li>Communications you send us directly</li>
          </ul>
          <Subheading>2.2 Information Collected Automatically</Subheading>
          <ul>
            <li>Log data including your IP address, browser type, pages visited, and timestamps</li>
            <li>Device information including operating system and screen resolution</li>
            <li>Cookies and similar tracking technologies used for authentication and session management</li>
            <li>Usage data such as features used, analyses performed, and exports generated</li>
          </ul>
          <Subheading>2.3 Information from Third Parties</Subheading>
          <ul>
            <li>If you sign in with Google, we receive your name, email address, and profile picture from Google in accordance with your Google account permissions</li>
            <li>Payment processing data from Stripe, including subscription status and transaction history</li>
          </ul>
        </Section>

        <Section title="3. How We Use Your Information">
          <p>We use the information we collect to:</p>
          <ul>
            <li>Provide, operate, and maintain the Service</li>
            <li>Process your video uploads and generate AI-powered music recommendations</li>
            <li>Process payments and manage your subscription</li>
            <li>Send transactional emails such as magic link authentication and receipts</li>
            <li>Respond to your comments, questions, and requests</li>
            <li>Monitor and analyze usage patterns to improve the Service</li>
            <li>Detect, prevent, and address technical issues and fraudulent activity</li>
            <li>Comply with legal obligations</li>
          </ul>
        </Section>

        <Section title="4. How We Store Your Information">
          <p>Your videos are stored temporarily on Amazon Web Services (AWS) S3 in the United States. Uploaded videos are used solely to perform AI analysis and generate music recommendations. We do not use your video content to train AI models. Your account data is stored in a Supabase PostgreSQL database hosted in the United States.</p>
          <p>We retain your data for as long as your account is active. If you delete your account, we will delete your personal data within 30 days, except where retention is required by law.</p>
        </Section>

        <Section title="5. Sharing Your Information">
          <p>We do not sell your personal information. We may share your information with:</p>
          <ul>
            <li><strong>Stripe, Inc.</strong> — payment processing</li>
            <li><strong>Amazon Web Services</strong> — cloud storage and infrastructure</li>
            <li><strong>Supabase</strong> — database hosting</li>
            <li><strong>Anthropic, PBC</strong> — AI analysis (video frames may be processed by Anthropic&apos;s Claude API; Anthropic&apos;s privacy policy governs their handling of this data)</li>
            <li><strong>Resend</strong> — transactional email delivery</li>
            <li><strong>Vercel</strong> — website hosting</li>
          </ul>
          <p>All third-party service providers are bound by contractual obligations to keep your information confidential and use it only for the purposes for which we disclose it to them.</p>
        </Section>

        <Section title="6. Your Rights">
          <p>Depending on your location, you may have the following rights regarding your personal data:</p>
          <ul>
            <li><strong>Access</strong> — request a copy of the personal data we hold about you</li>
            <li><strong>Correction</strong> — request that we correct inaccurate or incomplete data</li>
            <li><strong>Deletion</strong> — request that we delete your personal data</li>
            <li><strong>Portability</strong> — request your data in a machine-readable format</li>
            <li><strong>Objection</strong> — object to our processing of your data</li>
          </ul>
          <p>To exercise any of these rights, please contact us at <a href="mailto:privacy@backbeat.me" className="underline" style={{ color: "#C8A96E" }}>privacy@backbeat.me</a>. We will respond within 30 days.</p>
        </Section>

        <Section title="7. California Privacy Rights (CCPA)">
          <p>If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information we collect, the right to delete your personal information, and the right to opt out of the sale of your personal information. We do not sell personal information. To exercise your rights, contact us at <a href="mailto:privacy@backbeat.me" className="underline" style={{ color: "#C8A96E" }}>privacy@backbeat.me</a>.</p>
        </Section>

        <Section title="8. International Users (GDPR)">
          <p>If you are located in the European Economic Area (EEA), United Kingdom, or Switzerland, our legal basis for processing your personal data is: (a) performance of a contract when we provide the Service to you; (b) your consent where we ask for it; and (c) our legitimate interests in operating and improving the Service. You have the right to lodge a complaint with your local data protection authority.</p>
        </Section>

        <Section title="9. Cookies">
          <p>We use cookies and similar technologies for authentication and session management. We do not use third-party advertising cookies. For more information, see our <a href="/cookies" className="underline" style={{ color: "#C8A96E" }}>Cookie Policy</a>.</p>
        </Section>

        <Section title="10. Children's Privacy">
          <p>The Service is not directed to children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe we have inadvertently collected such information, please contact us immediately at <a href="mailto:privacy@backbeat.me" className="underline" style={{ color: "#C8A96E" }}>privacy@backbeat.me</a>.</p>
        </Section>

        <Section title="11. Changes to This Policy">
          <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the effective date. We encourage you to review this policy periodically.</p>
        </Section>

        <Section title="12. Contact Us">
          <p>If you have questions about this Privacy Policy, please contact us at:</p>
          <p><a href="mailto:hello@backbeat.me" className="underline" style={{ color: "#C8A96E" }}>hello@backbeat.me</a></p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold mb-4" style={{ color: "#C8A96E" }}>{title}</h2>
      <div className="space-y-3 text-[#d0d0d8] leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_strong]:text-white">
        {children}
      </div>
    </section>
  );
}

function Subheading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold mt-5 mb-2 text-white">{children}</h3>;
}
