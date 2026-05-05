/* ── rules.js ─────────────────────────────────────────────────────────────────
 * JS equivalent of rules.yaml.
 * Edit dealer toggles and patterns here — no other file changes.
 * For URL redirects during migration: add new URLs to the opposite pattern.
 * ─────────────────────────────────────────────────────────────────────────── */

const RULES = {

  dealers: {
    dealer_inspire: true,
    dealer_com:     true,
    dealer_socket:  true,
    tekion:         true,
    team_velocity:  true,
  },

  categories: {
    /* Core Inventory Pages */

    new_inventory: {
      label: 'New Inventory',
      providers: {
        dealer_inspire: { vdp: '/viewdetails/new',     srp: '/inventory/new' },
        dealer_com:     { vdp: '/new-inventory/vdp',   srp: '/new-inventory' },
        team_velocity:  { vdp: '/viewdetails/new',     srp: '/inventory/new' },
        dealer_socket:  { vdp: '/VehicleDetails/new',  srp: '/SearchNew' },
        tekion:         { vdp: '/vehicles/new/detail', srp: '/vehicles/new' },
      },
    },

    used_inventory: {
      label: 'Used Inventory',
      providers: {
        dealer_inspire: { vdp: '/viewdetails/used',     srp: '/inventory/used' },
        dealer_com:     { vdp: '/used-inventory/vdp',   srp: '/used-inventory' },
        team_velocity:  { vdp: '/viewdetails/used',     srp: '/inventory/used' },
        dealer_socket:  { vdp: '/VehicleDetails/used',  srp: '/SearchUsed' },
        tekion:         { vdp: '/vehicles/used/detail', srp: '/vehicles/used' },
      },
    },

    certified_inventory: {
      label: 'Certified Pre-Owned',
      providers: {
        dealer_inspire: { vdp: '/viewdetails/(certified|cpo)', srp: '/inventory/(certified|cpo)' },
        dealer_com:     { vdp: '/certified-inventory/vdp',     srp: '/certified-inventory' },
        team_velocity:  { vdp: '/certified/vdp',               srp: '/certified/all-vehicles' },
        dealer_socket:  { vdp: '/VehicleDetails/certified',    srp: '/SearchCertified' },
        tekion:         { vdp: '/vehicles/certified/detail',   srp: '/vehicles/certified' },
      },
    },

    /* Special Offers & Incentives */

    new_specials: {
      label: 'New Vehicle Specials',
      providers: {
        dealer_inspire: { page: '/specials/(new|vehicle-specials|vehiclespecials|new-vehicle-specials)' },
        dealer_com:     { page: '/offers/new' },
        team_velocity:  { page: '/specials/vehicle-specials' },
        dealer_socket:  { page: '/incentives/new' },
        tekion:         { page: '/promotions/new' },
      },
    },

    used_specials: {
      label: 'Used Vehicle Specials',
      providers: {
        dealer_inspire: { page: '/specials/(used|used-specials|preowned-specials)' },
        dealer_com:     { page: '/offers/used' },
        team_velocity:  { page: '/specials/preowned-specials' },
        dealer_socket:  { page: '/incentives/used' },
        tekion:         { page: '/promotions/used' },
      },
    },

    cpo_specials: {
      label: 'CPO / Certified Specials',
      providers: {
        dealer_inspire: { page: '/specials/(cpo|certified|certified-specials)' },
        dealer_com:     { page: '/offers/certified' },
        dealer_socket:  { page: '/incentives/certified' },
        tekion:         { page: '/promotions/certified' },
      },
    },

    /* Trade-In & Appraisal */

    trade_in: {
      label: 'Trade-In / Appraisal',
      providers: {
        dealer_inspire: { page: '/(trade-in|trade-in-value|appraisal|trade-appraisal)' },
        dealer_com:     { page: '/(trade-in|trade-value|appraisal)' },
        team_velocity:  { page: '/trade-in' },
        dealer_socket:  { page: '/(trade-in|trade-appraisal)' },
        tekion:         { page: '/trade-in' },
      },
    },

    /* Service & Maintenance */

    service: {
      label: 'Service Department',
      providers: {
        dealer_inspire: { page: '/(service|schedule-service|service-specials|maintenance|tires|oil-change|auto-repair|coupons)' },
        dealer_com:     { page: '/(service|schedule-service|service-coupons|tires|maintenance)' },
        team_velocity:  { page: '/service' },
        dealer_socket:  { page: '/(service|schedule-service|maintenance)' },
        tekion:         { page: '/service' },
      },
    },

    /* Financing */

    finance: {
      label: 'Finance / Apply',
      providers: {
        dealer_inspire: { page: '/(finance|apply-for-financing|credit-application|payment-calculator|get-approved|loan-application)' },
        dealer_com:     { page: '/(finance|financing|credit-application|loan)' },
        team_velocity:  { page: '/finance' },
        dealer_socket:  { page: '/(finance|credit-application|loan)' },
        tekion:         { page: '/finance' },
      },
    },

    /* Company Info */

    about: {
      label: 'About / Dealership Info',
      providers: {
        dealer_inspire: { page: '/(about|about-us|meet-our-staff|our-team|careers|reviews|testimonials|awards|community|dealership-info)' },
        dealer_com:     { page: '/(about|about-us|careers|reviews|staff|dealership)' },
        team_velocity:  { page: '/about' },
        dealer_socket:  { page: '/(about|about-us|dealership)' },
        tekion:         { page: '/(about|about-us)' },
      },
    },

    contact: {
      label: 'Contact',
      providers: {
        dealer_inspire: { page: '/(contact|contact-us|directions|hours|map|location)' },
        dealer_com:     { page: '/(contact|contact-us|hours-directions|directions|hours)' },
        team_velocity:  { page: '/contact' },
        dealer_socket:  { page: '/(contact|contact-us|location)' },
        tekion:         { page: '/(contact|contact-us)' },
      },
    },

    /* Content */

    blogs: {
      label: 'Blog / News',
      providers: {
        dealer_inspire: { page: '/blog' },
        dealer_com:     { page: '/(blog|news|articles|content)' },
        team_velocity:  { page: '/blog' },
        dealer_socket:  { page: '/blog' },
        tekion:         { page: '/content/blog' },
      },
    },

    model_research: {
      label: 'Model Research',
      providers: {
        dealer_inspire: { page: '/research-models' },
        dealer_com:     { page: '/research' },
        team_velocity:  { page: '/model-research' },
        dealer_socket:  { page: '/model-research' },
        tekion:         { page: '/research' },
      },
    },

    /* Vehicles / Parts */

    parts: {
      label: 'Parts / Accessories',
      providers: {
        dealer_inspire: { page: '/(parts|accessories|oe-parts)' },
        dealer_com:     { page: '/(parts|accessories)' },
        team_velocity:  { page: '/parts' },
        dealer_socket:  { page: '/parts' },
        tekion:         { page: '/parts' },
      },
    },

  },

  tags: {
    vdp: {
      label: 'Vehicle Detail Page',
      pattern: '/(viewdetails|vdp|detail|VehicleDetails|vehicle-details|vehicle-detail)/',
    },
    srp: {
      label: 'Search Results Page',
      pattern: '/(inventory|search|results|SearchNew|SearchUsed|SearchCertified|all-vehicles|vehicles)/',
    },
    mrp: {
      label: 'Model Research Page',
      pattern: '/(research-models|research|model-research|model|specs)/',
    },
    platform: {
      label: 'Platform Generated',
      derived_from: ['vdp', 'srp', 'mrp'],
    },
    specials: {
      label: 'Specials Page',
      pattern: '/(specials|offers|incentives|promotions|deals)/',
    },
    wildcardable: {
      label: 'VIN Wildcardable',
      pattern: '[A-HJ-NPR-Z0-9]{17}',
    },
    queryable: {
      label: 'Query Parameter Based',
      pattern: '\\?.*=(new|used|certified)',
    },
  },

};
