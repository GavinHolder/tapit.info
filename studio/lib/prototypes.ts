export type Prototype = { id: string; file: string; title: string; note: string; w: number; h: number; device: 'phone' | 'desktop' };

// The interactive mockups served from /public/prototypes. Add new boards here.
export const PROTOTYPES: Prototype[] = [
  { id: 'Landing', file: 'Landing.dc.html', title: 'Landing page', note: 'Public site with a live demo phone, FAQ and sign-up form.', w: 1280, h: 900, device: 'desktop' },
  { id: 'App', file: 'App.dc.html', title: 'Guest app (phone)', note: 'Stay, Explore, Trips and Wallet with sheets, filters, saving and trip replay.', w: 390, h: 844, device: 'phone' },
  { id: 'AppDesktop', file: 'AppDesktop.dc.html', title: 'Guest app (desktop)', note: 'The same app with a sidebar layout.', w: 1280, h: 860, device: 'desktop' },
  { id: 'Portal', file: 'Portal.dc.html', title: 'Business portal: editor', note: 'Edit the concierge page with a live phone preview, save and publish.', w: 1280, h: 900, device: 'desktop' },
  { id: 'Network', file: 'Network.dc.html', title: 'Admin: network overview', note: 'Date range, chart hover, sortable stands table and detail drawer.', w: 1280, h: 900, device: 'desktop' }
];
