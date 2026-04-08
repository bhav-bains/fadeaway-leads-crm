import fs from 'fs';
import { buildOutreachHtml } from '../src/lib/email-template';

const sampleBody = `Hi there,\n\nI was looking at your website and noticed a few things that could be improved regarding AI search visibility.\n\nLet me know if you'd be open to a quick chat this week.`;

const dummySignature = {
    fullName: "John Doe",
    title: "Creative Head",
    signatureUrl: "https://fadeawaycreatives.ca/"
};

const html = buildOutreachHtml(sampleBody, dummySignature);

fs.writeFileSync('preview-email.html', html);
console.log('Preview generated at preview-email.html');
