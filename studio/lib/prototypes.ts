export type Prototype = {
  id: string;
  file: string;
  title: string;
  note: string;
  w: number;
  h: number;
  device: 'phone' | 'desktop';
  /** 'current' / 'first' for the built-in boards; the group's own name for imported ones. */
  group: string;
  /** Built-in boards live in code and can be hidden and restored. Imported ones are real files and are deleted for good. */
  builtin?: boolean;
  kind?: 'dc' | 'html' | 'image';
  createdAt?: string;
};

export const GROUPS: Record<string, { title: string; note: string }> = {
  current: { title: 'Version 2: current', note: 'Clean and interactive. Click through them like a real product.' },
  first: { title: 'Version 1: earlier concepts', note: 'The first round of concepts, kept so every direction can still be reviewed and mixed.' }
};

// The built-in mockups served from studio/prototypes (built from ../mockups with `npm run prototypes`).
// New ones are imported in the app (Mockups page, Import) and stored in the database, not here.
export const BUILTIN: Prototype[] = [
  { builtin: true, id: 'Landing', file: 'Landing.dc.html', title: 'Landing page', note: 'Public site with a live demo phone, FAQ and sign-up form.', w: 1280, h: 3200, device: 'desktop', group: 'current' },
  { builtin: true, id: 'App', file: 'App.dc.html', title: 'Guest app (phone)', note: 'Stay, Explore, Trips and Wallet with sheets, filters, saving and trip replay.', w: 390, h: 844, device: 'phone', group: 'current' },
  { builtin: true, id: 'AppDesktop', file: 'AppDesktop.dc.html', title: 'Guest app (desktop)', note: 'The same app with a sidebar layout.', w: 1280, h: 860, device: 'desktop', group: 'current' },
  { builtin: true, id: 'Portal', file: 'Portal.dc.html', title: 'Business portal: editor', note: 'Edit the concierge page with a live phone preview, save and publish.', w: 1280, h: 900, device: 'desktop', group: 'current' },
  { builtin: true, id: 'Network', file: 'Network.dc.html', title: 'Admin: network overview', note: 'Date range, chart hover, sortable stands table and detail drawer.', w: 1280, h: 900, device: 'desktop', group: 'current' },

  { builtin: true, id: 'StyleLab', file: 'StyleLab.dc.html', title: 'Style lab', note: 'Mix base colours and accents, switch badge styles, flip the trip map between animated 3D and flat.', w: 1280, h: 1500, device: 'desktop', group: 'first' },
  { builtin: true, id: 'Main', file: 'Main.dc.html', title: 'Landing page (first concept)', note: 'The first landing page concept.', w: 1280, h: 2260, device: 'desktop', group: 'first' },
  { builtin: true, id: 'Guest', file: 'Guest.dc.html', title: 'Guest concierge (phone)', note: 'Wi-Fi, breakfast, house notes and check-out for one stay.', w: 390, h: 1180, device: 'phone', group: 'first' },
  { builtin: true, id: 'GuestDesktop', file: 'GuestDesktop.dc.html', title: 'Guest concierge (desktop)', note: 'The concierge page on a wide screen.', w: 1280, h: 1000, device: 'desktop', group: 'first' },
  { builtin: true, id: 'Trip', file: 'Trip.dc.html', title: 'Trip replay (phone)', note: 'The recorded route with the animated 3D scene.', w: 390, h: 1180, device: 'phone', group: 'first' },
  { builtin: true, id: 'TripDesktop', file: 'TripDesktop.dc.html', title: 'Trip replay (desktop)', note: 'Trip replay on a wide screen.', w: 1280, h: 900, device: 'desktop', group: 'first' },
  { builtin: true, id: 'Profile', file: 'Profile.dc.html', title: 'Explorer profile and passport', note: 'Stamps, badges and levels.', w: 390, h: 1180, device: 'phone', group: 'first' },
  { builtin: true, id: 'ExplorerDesktop', file: 'ExplorerDesktop.dc.html', title: 'Explorer profile (desktop)', note: 'Profile, passport and wallet on a wide screen.', w: 1280, h: 1300, device: 'desktop', group: 'first' },
  { builtin: true, id: 'Club', file: 'Club.dc.html', title: 'Wallet: partner perks and vouchers', note: 'Vouchers, membership perks and the points wallet.', w: 390, h: 1180, device: 'phone', group: 'first' },
  { builtin: true, id: 'Cms', file: 'Cms.dc.html', title: 'Business portal (first concept)', note: 'The first concierge editor concept.', w: 1280, h: 940, device: 'desktop', group: 'first' },
  { builtin: true, id: 'Admin', file: 'Admin.dc.html', title: 'Admin: network overview (first concept)', note: 'The first admin overview concept.', w: 1280, h: 940, device: 'desktop', group: 'first' },
  { builtin: true, id: 'Ledger', file: 'Ledger.dc.html', title: 'Admin: billing and commissions', note: 'Referral commission, subscriptions and invoices to businesses.', w: 1280, h: 940, device: 'desktop', group: 'first' }
];

export const PROTOTYPES = BUILTIN;
export const groupTitle = (g: string) => GROUPS[g]?.title ?? g;
