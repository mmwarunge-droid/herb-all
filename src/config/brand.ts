export const founder = {
  name: 'David Mureu Warunge',
  role: 'Founder · Herbal cultivation & knowledge-sharing',
  location: 'Ongata Rongai, Kenya',
  researchUrl:
    'https://www.researchgate.net/publication/273347609_Antischistosomal_Activity_of_Azadirachta_indica_and_Ekebergia_capensis_in_Mice_Infected_with_Schistosoma_mansoni',
};
export const photos = {
  laboratory: '/images/brand/founder-laboratory-1200.webp',
  founderGarden: '/images/brand/founder-garden-1200.webp',
  garden: '/images/brand/garden-plants-1200.webp',
  growing: '/images/brand/garden-growing-1200.webp',
  wheatgrass: '/images/brand/wheatgrass-1200.webp',
  moringa: '/images/brand/moringa-seedlings-1200.webp',
  rosemary: '/images/brand/rosemary-seedlings-1200.webp',
  packaged: '/images/brand/packaged-herbs-1200.webp',
};
export const enquiryTopics = [
  'General enquiry',
  'Products & seedlings',
  'Garden visit',
  'Consultation',
  'Practical learning',
] as const;
export type EnquiryTopic = (typeof enquiryTopics)[number];
export const enquiryPath = (topic: EnquiryTopic, item?: string) =>
  `/contact/?${new URLSearchParams({ topic, ...(item ? { item } : {}) })}`;
