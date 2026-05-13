import { Resend } from "resend";

export async function sendRecNotificationEmail(
  recipientEmail: string,
  senderName: string,
  albumTitle: string,
  albumArtist: string
) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: "Crates <crate@derek-brimley.com>",
    to: recipientEmail,
    subject: `${senderName} sent you an album`,
    html: `
      <p><strong>${senderName}</strong> thinks you should listen to:</p>
      <p><strong>${albumTitle}</strong> by ${albumArtist}</p>
      <p><a href="https://crates.derek-brimley.com/">Open Crates</a> to check it out.</p>
    `,
  });
}
