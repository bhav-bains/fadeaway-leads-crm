/**
 * Email HTML builder for outreach emails.
 * Keeps the body feeling like a personal email (no heavy template)
 * but adds a clean, branded signature block.
 */

interface SignatureData {
    fullName: string;
    title?: string;
    signatureUrl?: string;
}

/**
 * Converts plain text email body + signature data into a clean HTML email.
 * The body preserves line breaks so it reads like a personal message.
 */
export function buildOutreachHtml(body: string, signature: SignatureData): string {
    // Escape HTML in the body, then convert line breaks to <br>
    const escapedBody = body
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');

    const linkUrl = signature.signatureUrl || 'https://fadeawaycreatives.com';

    const signatureHtml = `
        <table cellpadding="0" cellspacing="0" border="0" style="margin-top:28px; border-top:2px solid #FF4F00; padding-top:20px;">
            <tr>
                <td style="vertical-align:top; padding-right:16px;">
                    <div style="width:4px; height:44px; background:#FF4F00; border-radius:2px;"></div>
                </td>
                <td style="vertical-align:top;">
                    <p style="margin:0 0 2px 0; font-size:15px; font-weight:700; color:#1a1a1a; font-family:Arial,Helvetica,sans-serif;">
                        ${escapeHtml(signature.fullName)}
                    </p>
                    ${signature.title ? `
                    <p style="margin:0 0 10px 0; font-size:12px; font-weight:600; color:#888888; text-transform:uppercase; letter-spacing:0.5px; font-family:Arial,Helvetica,sans-serif;">
                        ${escapeHtml(signature.title)}
                    </p>` : ''}
                    <p style="margin:0; font-size:13px; font-family:Arial,Helvetica,sans-serif;">
                        <a href="${escapeHtml(linkUrl)}" style="text-decoration:none;">
                            <span style="font-weight:700; color:#FF4F00;">FADEAWAY</span><span style="font-weight:700; color:#1a1a1a;"> CREATIVES</span>
                        </a>
                    </p>
                </td>
            </tr>
        </table>
    `;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#ffffff; font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:600px; margin:0 auto; padding:32px 24px; color:#1a1a1a; font-size:14px; line-height:1.7;">
        ${escapedBody}
        ${signatureHtml}
    </div>
</body>
</html>`.trim();
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
