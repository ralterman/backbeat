export const metadata = {
  title: "Cookie Policy — Backbeat",
};

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] px-6 py-16">
      <div className="max-w-[800px] mx-auto">
        <h1 className="text-3xl font-bold mb-1" style={{ color: "#C8A96E" }}>Cookie Policy</h1>
        <p className="text-sm text-[#9090aa] mb-10">Effective Date: March 25, 2026</p>

        <Section title="1. What Are Cookies">
          <p>Cookies are small text files that are placed on your device when you visit a website. They are widely used to make websites work efficiently and to provide information to website operators. This Cookie Policy explains how Backbeat uses cookies and similar technologies on backbeat.me.</p>
        </Section>

        <Section title="2. Cookies We Use">
          <Subheading>2.1 Strictly Necessary Cookies</Subheading>
          <p>These cookies are essential for the Service to function and cannot be switched off. They include:</p>
          <ul>
            <li><strong>Session cookies</strong> — maintain your logged-in state while you use the Service</li>
            <li><strong>Authentication cookies</strong> — set when you sign in via magic link or Google OAuth to keep you authenticated</li>
            <li><strong>Security cookies</strong> — help detect and prevent fraudulent activity</li>
          </ul>
          <p>These cookies do not store any personally identifiable information beyond what is necessary for authentication.</p>
          <Subheading>2.2 Functional Cookies</Subheading>
          <p>These cookies remember your preferences and settings to improve your experience:</p>
          <ul>
            <li><strong>User preference cookies</strong> — remember settings such as your subscription plan status</li>
            <li><strong>State cookies</strong> — maintain the state of your session between pages</li>
          </ul>
          <Subheading>2.3 Analytics Cookies</Subheading>
          <p>We may use privacy-friendly analytics tools to understand how users interact with the Service. Any analytics we use are configured to anonymize IP addresses and not track you across other websites.</p>
          <Subheading>2.4 What We Do NOT Use</Subheading>
          <p>We do not use:</p>
          <ul>
            <li>Advertising or targeting cookies</li>
            <li>Social media tracking cookies</li>
            <li>Third-party cookies for remarketing or retargeting</li>
          </ul>
        </Section>

        <Section title="3. Third-Party Cookies">
          <p>Some third-party services we use may set their own cookies:</p>
          <ul>
            <li><strong>Stripe</strong> — may set cookies related to payment processing when you visit checkout pages</li>
            <li><strong>Google</strong> — sets cookies if you use Google OAuth to sign in, governed by Google&apos;s Privacy Policy</li>
          </ul>
        </Section>

        <Section title="4. Managing Cookies">
          <p>You can control cookies through your browser settings. Most browsers allow you to refuse cookies or delete existing ones. Note that disabling cookies may affect the functionality of the Service — in particular, disabling session cookies will prevent you from staying logged in.</p>
          <p>To manage cookies in your browser, refer to your browser&apos;s help documentation:</p>
          <ul>
            <li><strong>Chrome:</strong> Settings &gt; Privacy and Security &gt; Cookies</li>
            <li><strong>Firefox:</strong> Settings &gt; Privacy &amp; Security &gt; Cookies and Site Data</li>
            <li><strong>Safari:</strong> Preferences &gt; Privacy &gt; Manage Website Data</li>
            <li><strong>Edge:</strong> Settings &gt; Cookies and Site Permissions</li>
          </ul>
        </Section>

        <Section title="5. Changes to This Policy">
          <p>We may update this Cookie Policy from time to time. Changes will be posted on this page with an updated effective date.</p>
        </Section>

        <Section title="6. Contact">
          <p>If you have questions about our use of cookies, please contact us at: <a href="mailto:hello@backbeat.me" className="underline" style={{ color: "#C8A96E" }}>hello@backbeat.me</a></p>
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
