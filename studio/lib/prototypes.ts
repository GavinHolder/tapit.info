export type Prototype = {
  id: string;
  file: string;
  title: string;
  note: string;
  w: number;
  h: number;
  device: 'phone' | 'desktop';
  group: 'current' | 'first';
};

export const GROUPS: Record<Prototype['group'], { title: string; note: string }> = {
  current: { title: 'Version 2: current', note: 'Clean and interactive. Click through them like a real product.' },
  first: { title: 'Version 1: earlier concepts', note: 'The first round of concepts, kept so every direction can still be reviewed and mixed.' }
};

// The mockups served from studio/prototypes (built from ../mockups with `npm run prototypes`). Add new boards here.
export const PROTOTYPES: Prototype[] = [
  { id: 'Landing', file: 'Landing.dc.html', title: 'Landing page', note: 'Public site with a live demo phone, FAQ and sign-up form.', w: 1280, h: 3200, device: 'desktop', group: 'current' },
  { id: 'App', file: 'App.dc.html', title: 'Guest app (phone)', note: 'Stay, Explore, Trips and Wallet with sheets, filters, saving and trip replay.', w: 390, h: 844, device: 'phone', group: 'current' },
  { id: 'AppDesktop', file: 'AppDesktop.dc.html', title: 'Guest app (desktop)', note: 'The same app with a sidebar layout.', w: 1280, h: 860, device: 'desktop', group: 'current' },
  { id: 'Portal', file: 'Portal.dc.html', title: 'Business portal: editor', note: 'Edit the concierge page with a live phone preview, save and publish.', w: 1280, h: 900, device: 'desktop', group: 'current' },
  { id: 'Network', file: 'Network.dc.html', title: 'Admin: network overview', note: 'Date range, chart hover, sortable stands table and detail drawer.', w: 1280, h: 900, device: 'desktop', group: 'current' },

  { id: 'StyleLab', file: 'StyleLab.dc.html', title: 'Style lab', note: 'Mix base colours and accents, switch badge styles, flip the trip map between animated 3D and flat.', w: 1280, h: 1500, device: 'desktop', group: 'first' },
  { id: 'Main', file: 'Main.dc.html', title: 'Landing page (first concept)', note: 'The first landing page concept.', w: 1280, h: 2260, device: 'desktop', group: 'first' },
  { id: 'Guest', file: 'Guest.dc.html', title: 'Guest concierge (phone)', note: 'Wi-Fi, breakfast, house notes and check-out for one stay.', w: 390, h: 1180, device: 'phone', group: 'first' },
  { id: 'GuestDesktop', file: 'GuestDesktop.dc.html', title: 'Guest concierge (desktop)', note: 'The concierge page on a wide screen.', w: 1280, h: 1000, device: 'desktop', group: 'first' },
  { id: 'Trip', file: 'Trip.dc.html', title: 'Trip replay (phone)', note: 'The recorded route with the animated 3D scene.', w: 390, h: 1180, device: 'phone', group: 'first' },
  { id: 'TripDesktop', file: 'TripDesktop.dc.html', title: 'Trip replay (desktop)', note: 'Trip replay on a wide screen.', w: 1280, h: 900, device: 'desktop', group: 'first' },
  { id: 'Profile', file: 'Profile.dc.html', title: 'Explorer profile and passport', note: 'Stamps, badges and levels.', w: 390, h: 1180, device: 'phone', group: 'first' },
  { id: 'ExplorerDesktop', file: 'ExplorerDesktop.dc.html', title: 'Explorer profile (desktop)', note: 'Profile, passport and wallet on a wide screen.', w: 1280, h: 1300, device: 'desktop', group: 'first' },
  { id: 'Club', file: 'Club.dc.html', title: 'Wallet: partner perks and vouchers', note: 'Vouchers, membership perks and the points wallet.', w: 390, h: 1180, device: 'phone', group: 'first' },
  { id: 'Cms', file: 'Cms.dc.html', title: 'Business portal (first concept)', note: 'The first concierge editor concept.', w: 1280, h: 940, device: 'desktop', group: 'first' },
  { id: 'Admin', file: 'Admin.dc.html', title: 'Admin: network overview (first concept)', note: 'The first admin overview concept.', w: 1280, h: 940, device: 'desktop', group: 'first' },
  { id: 'Ledger', file: 'Ledger.dc.html', title: 'Admin: billing and commissions', note: 'Referral commission, subscriptions and invoices to businesses.', w: 1280, h: 940, device: 'desktop', group: 'first' }
];
