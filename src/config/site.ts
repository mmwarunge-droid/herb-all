const env = import.meta.env;
export const site = {
  siteName: 'Herb-All',
  siteDescription:
    'Explore Herb-All botanical products, seedlings, garden visits and practical plant knowledge with founder David Mureu Warunge in Ongata Rongai, Kenya.',
  siteUrl: env.PUBLIC_SITE_URL || 'https://herb-all.example',
  email: env.PUBLIC_BUSINESS_EMAIL ?? 'dwmuriu725@gmail.com',
  phone: env.PUBLIC_PHONE_NUMBER ?? '+254722603819',
  whatsapp: env.PUBLIC_WHATSAPP_NUMBER ?? '+254722603819',
  facebook: env.PUBLIC_FACEBOOK_URL || '',
  instagram: env.PUBLIC_INSTAGRAM_URL || '',
  netlifyFormEnabled: env.PUBLIC_ENABLE_NETLIFY_FORM === 'true',
  defaultSocialImage: '/images/social.jpg',
  organization: { name: 'Herb-All' },
};
for (const key of ['siteUrl', 'facebook', 'instagram'] as const) {
  if (site[key] && !/^https:\/\//.test(site[key]))
    throw new Error(`${key} must be an HTTPS URL`);
}
export const socialLinks = [
  { name: 'Instagram', url: site.instagram },
  { name: 'Facebook', url: site.facebook },
].filter((link) => link.url);
export function enquiryLink(name: string) {
  const text = `Hello Herb-All, I would like more information about ${name}.`;
  if (site.whatsapp)
    return `https://wa.me/${site.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;
  if (site.email)
    return `mailto:${site.email}?subject=${encodeURIComponent('Enquiry: ' + name)}&body=${encodeURIComponent(text)}`;
  return `/contact/?item=${encodeURIComponent(name)}`;
}
