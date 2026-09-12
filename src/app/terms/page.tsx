export const metadata = {
  title: "Terms of Service — Backbeat",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] px-6 py-16">
      <div className="max-w-[800px] mx-auto">
        <h1 className="text-3xl font-bold mb-1" style={{ color: "#C8A96E" }}>Terms of Service</h1>
        <p className="text-sm text-[#9090aa] mb-10">Effective Date: March 25, 2026</p>

        <Section title="1. Acceptance of Terms">
          <p>By accessing or using Backbeat (&ldquo;Service&rdquo;) at backbeat.me, you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree to these Terms, do not use the Service. These Terms apply to all visitors, users, and others who access the Service.</p>
        </Section>

        <Section title="2. Description of Service">
          <p>Backbeat is an AI-powered platform that analyzes video content and generates custom background music using ElevenLabs&apos; music AI. Backbeat analyzes your video&apos;s mood, energy, pacing, and scene context, then produces a unique music track tailored to your content. Users may upload videos, receive a generated music track, preview it, and export a finished video with the music mixed in.</p>
        </Section>

        <Section title="3. Accounts">
          <p>To use certain features of the Service, you must create an account. You agree to:</p>
          <ul>
            <li>Provide accurate, current, and complete information during registration</li>
            <li>Maintain the security of your account credentials</li>
            <li>Notify us immediately of any unauthorized use of your account</li>
            <li>Accept responsibility for all activities that occur under your account</li>
          </ul>
          <p>We reserve the right to suspend or terminate accounts that violate these Terms or engage in fraudulent activity.</p>
        </Section>

        <Section title="4. Subscriptions and Billing">
          <Subheading>4.1 Free Tier</Subheading>
          <p>The free tier allows one (1) lifetime video analysis, includes 1 AI video analysis per month, generating 2 custom soundtrack options with full-length preview. Free tier exports include a &lsquo;Made with Backbeat&rsquo; watermark.</p>
          <Subheading>4.2 Paid Subscriptions</Subheading>
          <p>Paid subscription plans are billed monthly. By subscribing, you authorize us to charge your payment method on a recurring basis. Prices are as displayed at backbeat.me/pricing at the time of purchase.</p>
          <Subheading>4.3 Cancellation and Refunds</Subheading>
          <p>You may cancel your subscription at any time. Cancellation takes effect at the end of the current billing period. We do not provide refunds for partial months. If you believe you have been charged in error, contact us at <a href="mailto:hello@backbeat.me" className="underline" style={{ color: "#C8A96E" }}>hello@backbeat.me</a> within 30 days of the charge.</p>
          <Subheading>4.4 Price Changes</Subheading>
          <p>We reserve the right to modify subscription prices with 30 days&apos; notice. Continued use of the Service after a price change constitutes acceptance of the new pricing.</p>
        </Section>

        <Section title="5. User Content">
          <Subheading>5.1 Your Content</Subheading>
          <p>You retain all ownership rights to videos you upload to the Service (&ldquo;User Content&rdquo;). By uploading content, you grant Backbeat a limited, non-exclusive license to process your content solely for the purpose of providing the Service to you.</p>
          <Subheading>5.2 Content Restrictions</Subheading>
          <p>You agree not to upload content that:</p>
          <ul>
            <li>Infringes any third party&apos;s intellectual property rights</li>
            <li>Contains illegal, harmful, threatening, abusive, or defamatory material</li>
            <li>Contains nudity, sexual content, or graphic violence</li>
            <li>Violates any applicable law or regulation</li>
          </ul>
          <p>We reserve the right to remove any content that violates these restrictions without notice.</p>
          <Subheading>5.3 Content Retention</Subheading>
          <p>Uploaded videos are stored temporarily for processing and export generation. We do not permanently archive your video content. Processed videos may be deleted from our servers within 30 days of upload.</p>
        </Section>

        <Section title="6. Music Licensing">
          <p>All music generated through the Service is produced by ElevenLabs&apos; AI music generation technology and is licensed for commercial use, including publication on YouTube, TikTok, Instagram, and similar platforms. Generated music is covered under ElevenLabs&apos; music rights policy — see <a href="https://elevenlabs.io/music-rights" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "#C8A96E" }}>elevenlabs.io/music-rights</a> for full terms.</p>
          <p>You retain the right to use AI-generated music produced through Backbeat in your video content across standard social media platforms without additional licensing fees, subject to ElevenLabs&apos; current terms of service. For commercial broadcast, film, television, or advertising use beyond standard social media, please review ElevenLabs&apos; commercial licensing terms directly before use.</p>
          <p>Music is generated by AI and is provided &ldquo;as is.&rdquo; We do not guarantee that any generated track will be a perfect fit for your content or that ElevenLabs&apos; licensing terms will remain unchanged over time.</p>
        </Section>

        <Section title="7. Intellectual Property">
          <p>The Service and its original content (excluding User Content), features, and functionality are owned by Backbeat and are protected by intellectual property laws. The Backbeat name, logo, and brand assets may not be used without our prior written consent.</p>
        </Section>

        <Section title="8. Prohibited Uses">
          <p>You agree not to:</p>
          <ul>
            <li>Use the Service for any unlawful purpose</li>
            <li>Attempt to reverse engineer, decompile, or extract the source code of the Service</li>
            <li>Use automated means to access or scrape the Service</li>
            <li>Resell or sublicense access to the Service</li>
            <li>Attempt to circumvent subscription limits or free tier restrictions</li>
            <li>Interfere with the proper functioning of the Service</li>
            <li>Remove or alter any watermarks on free tier exports</li>
          </ul>
        </Section>

        <Section title="9. Disclaimers">
          <p>THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. BACKBEAT DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS. AI-GENERATED MUSIC RECOMMENDATIONS ARE PROVIDED FOR INFORMATIONAL PURPOSES AND MAY NOT ALWAYS MATCH YOUR CREATIVE VISION.</p>
        </Section>

        <Section title="10. Limitation of Liability">
          <p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, BACKBEAT SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY TO YOU SHALL NOT EXCEED THE AMOUNT YOU PAID TO US IN THE 12 MONTHS PRECEDING THE CLAIM.</p>
        </Section>

        <Section title="11. Indemnification">
          <p>You agree to indemnify, defend, and hold harmless Backbeat and its officers, directors, employees, and agents from any claims, liabilities, damages, losses, and expenses arising out of your use of the Service, your User Content, or your violation of these Terms.</p>
        </Section>

        <Section title="12. Termination">
          <p>We may terminate or suspend your account and access to the Service immediately, without prior notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties. Upon termination, your right to use the Service will immediately cease.</p>
        </Section>

        <Section title="13. Governing Law">
          <p>These Terms shall be governed by the laws of the State of New York, without regard to its conflict of law provisions. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts located in New York County, New York.</p>
        </Section>

        <Section title="14. Changes to Terms">
          <p>We reserve the right to modify these Terms at any time. We will provide notice of significant changes by email or by posting a notice on the Service. Your continued use of the Service after changes take effect constitutes your acceptance of the revised Terms.</p>
        </Section>

        <Section title="15. Contact">
          <p>Questions about these Terms should be sent to: <a href="mailto:hello@backbeat.me" className="underline" style={{ color: "#C8A96E" }}>hello@backbeat.me</a></p>
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
