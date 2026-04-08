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

    const linkUrl = signature.signatureUrl || 'https://fadeawaycreatives.ca/';

    const signatureHtml = `
        <br><br>
        --<br>
        ${escapeHtml(signature.fullName)}<br>
        ${signature.title ? `${escapeHtml(signature.title)}<br>` : ''}
        <a href="${escapeHtml(linkUrl)}" style="color: #FF4F00; text-decoration: none; font-weight: 500;">Fadeaway Creatives</a>
    `;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
</head>
<body style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #222; margin: 0; padding: 0;">
    <div style="padding: 16px;">
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
