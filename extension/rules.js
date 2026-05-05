/* ── rules.js ─────────────────────────────────────────────────────────────────
 * JS equivalent of rules.yaml.
 * Edit dealer toggles and patterns here — no other file changes.
 * For URL redirects during migration: add new URLs to the opposite pattern.
 * ─────────────────────────────────────────────────────────────────────────── */

const RULES = {

  dealers: {
    /* Tier 1: Enterprise Giants */
    cdk_global:      true,  // CDK Global - dominant DMS
    reynolds_web:    true,  // Reynolds & Reynolds - legacy DMS leader
    tekion:          true,  // Tekion - cloud-native DMS (emerging)
    dealer_com:      true,  // Dealer.com (Cox Automotive/Dealertrack)
    dealer_socket:   true,  // DealerSocket - omnichannel DMS

    /* Tier 2: Major Website/Marketing Platforms */
    overfuel:        true,  // #1 ranked dealer website provider 2025
    dealeron:        true,  // DealerOn - lead generation & marketing
    dealer_inspire:  true,  // Dealer Inspire - AI-driven websites
    dealer_eprocess: true,  // Dealer eProcess - SEO-driven platform
    team_velocity:   true,  // Team Velocity - integrated solutions
    autorevo:        true,  // AutoRevo - customizable website builder
    spyne:           true,  // Spyne - inventory & digital marketing
    heyauto:         true,  // HeyAuto - marketplace & solutions

    /* Tier 3: Specialized/Regional Platforms */
    fox_dealer:      true,  // Fox Dealer - dealer assets & marketing
    sincro:          true,  // Sincro (Ansira) - inventory management
    naked_lime:      true,  // Naked Lime - personalized websites
    dominion:        true,  // Dominion Dealer - DMS & digital
    stream_companies: true,  // Stream Companies - digital solutions
    car_research:    true,  // Car-Research - XRM platform
    tradepending:    true,  // TradePending - platform & content
    edealer:         true,  // eDealer - Canadian-focused platform
    flick_fusion:    true,  // Flick Fusion - video marketing (7000+ dealerships)
    izmocars:        true,  // Izmocars - website & inventory
    motordesk:       true,  // MotorDesk - used car software
    vehiso:          true,  // Vehiso - CMS & DMS solutions
    dealerclick:     true,  // DealerClick - inventory, CRM, websites
  },

  categories: {
    /* Core Inventory Pages */

    new_inventory: {
      label: 'New Inventory',
      providers: {
        autorevo:        { vdp: '/new-vehicles/(.*)',   srp: '/new-vehicles' },
        dealer_inspire:  { vdp: '/viewdetails/new',     srp: '/inventory/new' },
        dealer_com:      { vdp: '/new-inventory/vdp',   srp: '/new-inventory' },
        dealerclick:     { vdp: '/new-cars/(.*)',       srp: '/new-cars' },
        dealeron:        { vdp: '/new-cars/(.*)/details', srp: '/new-cars' },
        dealer_eprocess: { vdp: '/new-cars/(.*)/(.*)',  srp: '/new-cars' },
        cdk_global:      { vdp: '/vehicledetails/new',  srp: '/inventory/new' },
        car_research:    { vdp: '/vehicle/(.*)/new',    srp: '/inventory/new' },
        dominion:        { vdp: '/new-vehicles/(.*)',   srp: '/new-vehicles' },
        edealer:         { vdp: '/vehicles/new/(.*)',   srp: '/vehicles/new' },
        flick_fusion:    { vdp: '/new/(.*)/details',    srp: '/new' },
        fox_dealer:      { vdp: '/inventory/new/(.*)',  srp: '/inventory/new' },
        heyauto:         { vdp: '/new-cars/(.*)/details', srp: '/new-cars' },
        izmocars:        { vdp: '/inventory/new/(.*)',  srp: '/inventory/new' },
        motordesk:       { vdp: '/vehicles/new/(.*)',   srp: '/vehicles/new' },
        naked_lime:      { vdp: '/inventory/new/(.*)',  srp: '/inventory/new' },
        overfuel:        { vdp: '/new-inventory/(.*)',  srp: '/new-inventory' },
        reynolds_web:    { vdp: '/new-inventory/(.*)',  srp: '/new-inventory' },
        sincro:          { vdp: '/vehicles/new/(.*)/',  srp: '/vehicles/new' },
        spyne:           { vdp: '/new-cars/(.*)/details', srp: '/new-cars' },
        stream_companies: { vdp: '/inventory/new/(.*)', srp: '/inventory/new' },
        team_velocity:   { vdp: '/viewdetails/new',     srp: '/inventory/new' },
        tekion:          { vdp: '/vehicles/new/detail', srp: '/vehicles/new' },
        tradepending:    { vdp: '/new/(.*)/details',    srp: '/new' },
        dealer_socket:   { vdp: '/VehicleDetails/new',  srp: '/SearchNew' },
        vehiso:          { vdp: '/vehicles/new/(.*)',   srp: '/vehicles/new' },
      },
    },

    used_inventory: {
      label: 'Used Inventory',
      providers: {
        autorevo:        { vdp: '/used-vehicles/(.*)',   srp: '/used-vehicles' },
        dealer_inspire:  { vdp: '/viewdetails/used',     srp: '/inventory/used' },
        dealer_com:      { vdp: '/used-inventory/vdp',   srp: '/used-inventory' },
        dealerclick:     { vdp: '/used-cars/(.*)',       srp: '/used-cars' },
        dealeron:        { vdp: '/used-cars/(.*)/details', srp: '/used-cars' },
        dealer_eprocess: { vdp: '/used-cars/(.*)/(.*)',  srp: '/used-cars' },
        cdk_global:      { vdp: '/vehicledetails/used',  srp: '/inventory/used' },
        car_research:    { vdp: '/vehicle/(.*)/used',    srp: '/inventory/used' },
        dominion:        { vdp: '/used-vehicles/(.*)',   srp: '/used-vehicles' },
        edealer:         { vdp: '/vehicles/used/(.*)',   srp: '/vehicles/used' },
        flick_fusion:    { vdp: '/used/(.*)/details',    srp: '/used' },
        fox_dealer:      { vdp: '/inventory/used/(.*)',  srp: '/inventory/used' },
        heyauto:         { vdp: '/used-cars/(.*)/details', srp: '/used-cars' },
        izmocars:        { vdp: '/inventory/used/(.*)',  srp: '/inventory/used' },
        motordesk:       { vdp: '/vehicles/used/(.*)',   srp: '/vehicles/used' },
        naked_lime:      { vdp: '/inventory/used/(.*)',  srp: '/inventory/used' },
        overfuel:        { vdp: '/used-inventory/(.*)',  srp: '/used-inventory' },
        reynolds_web:    { vdp: '/used-inventory/(.*)',  srp: '/used-inventory' },
        sincro:          { vdp: '/vehicles/used/(.*)/',  srp: '/vehicles/used' },
        spyne:           { vdp: '/used-cars/(.*)/details', srp: '/used-cars' },
        stream_companies: { vdp: '/inventory/used/(.*)', srp: '/inventory/used' },
        team_velocity:   { vdp: '/viewdetails/used',     srp: '/inventory/used' },
        tekion:          { vdp: '/vehicles/used/detail', srp: '/vehicles/used' },
        tradepending:    { vdp: '/used/(.*)/details',    srp: '/used' },
        dealer_socket:   { vdp: '/VehicleDetails/used',  srp: '/SearchUsed' },
        vehiso:          { vdp: '/vehicles/used/(.*)',   srp: '/vehicles/used' },
      },
    },

    certified_inventory: {
      label: 'Certified Pre-Owned',
      providers: {
        autorevo:        { vdp: '/(cpo|certified)-vehicles/(.*)', srp: '/(cpo|certified)-vehicles' },
        dealer_inspire:  { vdp: '/viewdetails/(certified|cpo)', srp: '/inventory/(certified|cpo)' },
        dealer_com:      { vdp: '/certified-inventory/vdp',     srp: '/certified-inventory' },
        dealerclick:     { vdp: '/certified-cars/(.*)',         srp: '/certified-cars' },
        dealeron:        { vdp: '/certified-cars/(.*)/details', srp: '/certified-cars' },
        dealer_eprocess: { vdp: '/certified-cars/(.*)/(.*)',    srp: '/certified-cars' },
        cdk_global:      { vdp: '/vehicledetails/certified',    srp: '/inventory/certified' },
        car_research:    { vdp: '/vehicle/(.*)/certified',     srp: '/inventory/certified' },
        dominion:        { vdp: '/(cpo|certified)-vehicles/(.*)', srp: '/(cpo|certified)-vehicles' },
        edealer:         { vdp: '/vehicles/(cpo|certified)/(.*)', srp: '/vehicles/(cpo|certified)' },
        flick_fusion:    { vdp: '/(cpo|certified)/(.*)/details', srp: '/(cpo|certified)' },
        fox_dealer:      { vdp: '/inventory/(cpo|certified)/(.*)', srp: '/inventory/(cpo|certified)' },
        heyauto:         { vdp: '/certified-cars/(.*)/details',  srp: '/certified-cars' },
        izmocars:        { vdp: '/inventory/(cpo|certified)/(.*)', srp: '/inventory/(cpo|certified)' },
        motordesk:       { vdp: '/vehicles/(cpo|certified)/(.*)', srp: '/vehicles/(cpo|certified)' },
        naked_lime:      { vdp: '/inventory/(cpo|certified)/(.*)', srp: '/inventory/(cpo|certified)' },
        overfuel:        { vdp: '/certified-inventory/vdp',       srp: '/certified-inventory' },
        reynolds_web:    { vdp: '/(cpo|certified)-inventory/(.*)', srp: '/(cpo|certified)-inventory' },
        sincro:          { vdp: '/vehicles/(cpo|certified)/(.*)/', srp: '/vehicles/(cpo|certified)' },
        spyne:           { vdp: '/certified-cars/(.*)/details',  srp: '/certified-cars' },
        stream_companies: { vdp: '/inventory/(cpo|certified)/(.*)', srp: '/inventory/(cpo|certified)' },
        team_velocity:   { vdp: '/certified/vdp',               srp: '/certified/all-vehicles' },
        tekion:          { vdp: '/vehicles/certified/detail',   srp: '/vehicles/certified' },
        tradepending:    { vdp: '/(cpo|certified)/(.*)/details', srp: '/(cpo|certified)' },
        dealer_socket:   { vdp: '/VehicleDetails/certified',    srp: '/SearchCertified' },
        vehiso:          { vdp: '/vehicles/(cpo|certified)/(.*)', srp: '/vehicles/(cpo|certified)' },
      },
    },

    /* Special Offers & Incentives */

    new_specials: {
      label: 'New Vehicle Specials',
      providers: {
        autorevo:        { page: '/(specials|offers)/new' },
        dealer_inspire:  { page: '/specials/(new|vehicle-specials|vehiclespecials|new-vehicle-specials)' },
        dealer_com:      { page: '/offers/new' },
        dealerclick:     { page: '/(specials|offers)/new' },
        dealeron:        { page: '/new-cars/specials' },
        dealer_eprocess: { page: '/(specials|offers)/new' },
        cdk_global:      { page: '/(specials|offers)/new' },
        car_research:    { page: '/specials/new' },
        dominion:        { page: '/new-vehicle-specials' },
        edealer:         { page: '/specials/new' },
        flick_fusion:    { page: '/new-vehicle-specials' },
        fox_dealer:      { page: '/(specials|offers)/new' },
        heyauto:         { page: '/(specials|offers)/new' },
        izmocars:        { page: '/(specials|offers)/new' },
        motordesk:       { page: '/(specials|offers)/new' },
        naked_lime:      { page: '/(specials|offers)/new' },
        overfuel:        { page: '/offers/new' },
        reynolds_web:    { page: '/(specials|offers)/new' },
        sincro:          { page: '/specials/new' },
        spyne:           { page: '/(specials|offers)/new' },
        stream_companies: { page: '/(specials|offers)/new' },
        team_velocity:   { page: '/specials/vehicle-specials' },
        tekion:          { page: '/promotions/new' },
        tradepending:    { page: '/new-vehicle-specials' },
        dealer_socket:   { page: '/incentives/new' },
        vehiso:          { page: '/(specials|offers)/new' },
      },
    },

    used_specials: {
      label: 'Used Vehicle Specials',
      providers: {
        autorevo:        { page: '/(specials|offers)/used' },
        dealer_inspire:  { page: '/specials/(used|used-specials|preowned-specials)' },
        dealer_com:      { page: '/offers/used' },
        dealerclick:     { page: '/(specials|offers)/used' },
        dealeron:        { page: '/used-cars/specials' },
        dealer_eprocess: { page: '/(specials|offers)/used' },
        cdk_global:      { page: '/(specials|offers)/used' },
        car_research:    { page: '/specials/used' },
        dominion:        { page: '/used-vehicle-specials' },
        edealer:         { page: '/specials/used' },
        flick_fusion:    { page: '/used-vehicle-specials' },
        fox_dealer:      { page: '/(specials|offers)/used' },
        heyauto:         { page: '/(specials|offers)/used' },
        izmocars:        { page: '/(specials|offers)/used' },
        motordesk:       { page: '/(specials|offers)/used' },
        naked_lime:      { page: '/(specials|offers)/used' },
        overfuel:        { page: '/offers/used' },
        reynolds_web:    { page: '/(specials|offers)/used' },
        sincro:          { page: '/specials/used' },
        spyne:           { page: '/(specials|offers)/used' },
        stream_companies: { page: '/(specials|offers)/used' },
        team_velocity:   { page: '/specials/preowned-specials' },
        tekion:          { page: '/promotions/used' },
        tradepending:    { page: '/used-vehicle-specials' },
        dealer_socket:   { page: '/incentives/used' },
        vehiso:          { page: '/(specials|offers)/used' },
      },
    },

    cpo_specials: {
      label: 'CPO / Certified Specials',
      providers: {
        autorevo:        { page: '/(specials|offers)/(cpo|certified)' },
        dealer_inspire:  { page: '/specials/(cpo|certified|certified-specials)' },
        dealer_com:      { page: '/offers/certified' },
        dealerclick:     { page: '/(specials|offers)/(cpo|certified)' },
        dealeron:        { page: '/certified-cars/specials' },
        dealer_eprocess: { page: '/(specials|offers)/(cpo|certified)' },
        cdk_global:      { page: '/(specials|offers)/(cpo|certified)' },
        car_research:    { page: '/specials/(cpo|certified)' },
        dominion:        { page: '/(cpo|certified)-vehicle-specials' },
        edealer:         { page: '/specials/(cpo|certified)' },
        flick_fusion:    { page: '/(cpo|certified)-vehicle-specials' },
        fox_dealer:      { page: '/(specials|offers)/(cpo|certified)' },
        heyauto:         { page: '/(specials|offers)/(cpo|certified)' },
        izmocars:        { page: '/(specials|offers)/(cpo|certified)' },
        motordesk:       { page: '/(specials|offers)/(cpo|certified)' },
        naked_lime:      { page: '/(specials|offers)/(cpo|certified)' },
        overfuel:        { page: '/offers/certified' },
        reynolds_web:    { page: '/(specials|offers)/(cpo|certified)' },
        sincro:          { page: '/specials/(cpo|certified)' },
        spyne:           { page: '/(specials|offers)/(cpo|certified)' },
        stream_companies: { page: '/(specials|offers)/(cpo|certified)' },
        // team_velocity: not present - team_velocity uses /certified/all-vehicles as main listing, no separate specials section
        tekion:          { page: '/promotions/certified' },
        tradepending:    { page: '/(cpo|certified)-vehicle-specials' },
        dealer_socket:   { page: '/incentives/certified' },
        vehiso:          { page: '/(specials|offers)/(cpo|certified)' },
      },
    },

    /* Trade-In & Appraisal */

    trade_in: {
      label: 'Trade-In / Appraisal',
      providers: {
        autorevo:        { page: '/(trade-in|appraisal)' },
        dealer_inspire:  { page: '/(trade-in|trade-in-value|appraisal|trade-appraisal)' },
        dealer_com:      { page: '/(trade-in|trade-value|appraisal)' },
        dealerclick:     { page: '/(trade-in|appraisal)' },
        dealeron:        { page: '/(trade-in|appraisal)' },
        dealer_eprocess: { page: '/(trade-in|appraisal)' },
        cdk_global:      { page: '/(trade-in|appraisal|trade-appraisal)' },
        car_research:    { page: '/trade-in' },
        dominion:        { page: '/trade-in' },
        edealer:         { page: '/trade-in' },
        flick_fusion:    { page: '/trade-in' },
        fox_dealer:      { page: '/(trade-in|appraisal)' },
        heyauto:         { page: '/(trade-in|appraisal)' },
        izmocars:        { page: '/(trade-in|appraisal)' },
        motordesk:       { page: '/(trade-in|appraisal)' },
        naked_lime:      { page: '/(trade-in|appraisal)' },
        overfuel:        { page: '/(trade-in|trade-value|appraisal)' },
        reynolds_web:    { page: '/(trade-in|appraisal)' },
        sincro:          { page: '/trade-in' },
        spyne:           { page: '/(trade-in|appraisal)' },
        stream_companies: { page: '/(trade-in|appraisal)' },
        team_velocity:   { page: '/trade-in' },
        tekion:          { page: '/trade-in' },
        tradepending:    { page: '/trade-in' },
        dealer_socket:   { page: '/(trade-in|trade-appraisal)' },
        vehiso:          { page: '/(trade-in|appraisal)' },
      },
    },

    /* Service & Maintenance */

    service: {
      label: 'Service Department',
      providers: {
        autorevo:        { page: '/(service|maintenance)' },
        dealer_inspire:  { page: '/(service|schedule-service|service-specials|maintenance|tires|oil-change|auto-repair|coupons)' },
        dealer_com:      { page: '/(service|schedule-service|service-coupons|tires|maintenance)' },
        dealerclick:     { page: '/(service|maintenance)' },
        dealeron:        { page: '/service' },
        dealer_eprocess: { page: '/(service|maintenance)' },
        cdk_global:      { page: '/(service|maintenance|schedule-service)' },
        car_research:    { page: '/service' },
        dominion:        { page: '/service' },
        edealer:         { page: '/service' },
        flick_fusion:    { page: '/service' },
        fox_dealer:      { page: '/(service|maintenance)' },
        heyauto:         { page: '/(service|maintenance)' },
        izmocars:        { page: '/(service|maintenance)' },
        motordesk:       { page: '/(service|maintenance)' },
        naked_lime:      { page: '/(service|maintenance)' },
        overfuel:        { page: '/(service|schedule-service|maintenance)' },
        reynolds_web:    { page: '/(service|maintenance)' },
        sincro:          { page: '/service' },
        spyne:           { page: '/(service|maintenance)' },
        stream_companies: { page: '/(service|maintenance)' },
        team_velocity:   { page: '/service' },
        tekion:          { page: '/service' },
        tradepending:    { page: '/service' },
        dealer_socket:   { page: '/(service|schedule-service|maintenance)' },
        vehiso:          { page: '/(service|maintenance)' },
      },
    },

    /* Financing */

    finance: {
      label: 'Finance / Apply',
      providers: {
        autorevo:        { page: '/(finance|financing)' },
        dealer_inspire:  { page: '/(finance|apply-for-financing|credit-application|payment-calculator|get-approved|loan-application)' },
        dealer_com:      { page: '/(finance|financing|credit-application|loan)' },
        dealerclick:     { page: '/(finance|financing)' },
        dealeron:        { page: '/(finance|financing)' },
        dealer_eprocess: { page: '/(finance|financing)' },
        cdk_global:      { page: '/(finance|financing|credit-application)' },
        car_research:    { page: '/finance' },
        dominion:        { page: '/finance' },
        edealer:         { page: '/finance' },
        flick_fusion:    { page: '/finance' },
        fox_dealer:      { page: '/(finance|financing)' },
        heyauto:         { page: '/(finance|financing)' },
        izmocars:        { page: '/(finance|financing)' },
        motordesk:       { page: '/(finance|financing)' },
        naked_lime:      { page: '/(finance|financing)' },
        overfuel:        { page: '/(finance|financing|credit-application|loan)' },
        reynolds_web:    { page: '/(finance|financing)' },
        sincro:          { page: '/finance' },
        spyne:           { page: '/(finance|financing)' },
        stream_companies: { page: '/(finance|financing)' },
        team_velocity:   { page: '/finance' },
        tekion:          { page: '/finance' },
        tradepending:    { page: '/finance' },
        dealer_socket:   { page: '/(finance|credit-application|loan)' },
        vehiso:          { page: '/(finance|financing)' },
      },
    },

    /* Company Info */

    about: {
      label: 'About / Dealership Info',
      providers: {
        autorevo:        { page: '/(about|about-us)' },
        dealer_inspire:  { page: '/(about|about-us|meet-our-staff|our-team|careers|reviews|testimonials|awards|community|dealership-info)' },
        dealer_com:      { page: '/(about|about-us|careers|reviews|staff|dealership)' },
        dealerclick:     { page: '/(about|about-us)' },
        dealeron:        { page: '/(about|about-us)' },
        dealer_eprocess: { page: '/(about|about-us)' },
        cdk_global:      { page: '/(about|about-us)' },
        car_research:    { page: '/about' },
        dominion:        { page: '/about' },
        edealer:         { page: '/about' },
        flick_fusion:    { page: '/about' },
        fox_dealer:      { page: '/(about|about-us)' },
        heyauto:         { page: '/(about|about-us)' },
        izmocars:        { page: '/(about|about-us)' },
        motordesk:       { page: '/(about|about-us)' },
        naked_lime:      { page: '/(about|about-us)' },
        overfuel:        { page: '/(about|about-us|careers|reviews|staff|dealership)' },
        reynolds_web:    { page: '/(about|about-us)' },
        sincro:          { page: '/about' },
        spyne:           { page: '/(about|about-us)' },
        stream_companies: { page: '/(about|about-us)' },
        team_velocity:   { page: '/about' },
        tekion:          { page: '/(about|about-us)' },
        tradepending:    { page: '/about' },
        dealer_socket:   { page: '/(about|about-us|dealership)' },
        vehiso:          { page: '/(about|about-us)' },
      },
    },

    contact: {
      label: 'Contact',
      providers: {
        autorevo:        { page: '/(contact|contact-us)' },
        dealer_inspire:  { page: '/(contact|contact-us|directions|hours|map|location)' },
        dealer_com:      { page: '/(contact|contact-us|hours-directions|directions|hours)' },
        dealerclick:     { page: '/(contact|contact-us)' },
        dealeron:        { page: '/(contact|contact-us)' },
        dealer_eprocess: { page: '/(contact|contact-us)' },
        cdk_global:      { page: '/(contact|contact-us|location)' },
        car_research:    { page: '/contact' },
        dominion:        { page: '/contact' },
        edealer:         { page: '/contact' },
        flick_fusion:    { page: '/contact' },
        fox_dealer:      { page: '/(contact|contact-us)' },
        heyauto:         { page: '/(contact|contact-us)' },
        izmocars:        { page: '/(contact|contact-us)' },
        motordesk:       { page: '/(contact|contact-us)' },
        naked_lime:      { page: '/(contact|contact-us)' },
        overfuel:        { page: '/(contact|contact-us|hours-directions|directions|hours)' },
        reynolds_web:    { page: '/(contact|contact-us)' },
        sincro:          { page: '/contact' },
        spyne:           { page: '/(contact|contact-us)' },
        stream_companies: { page: '/(contact|contact-us)' },
        team_velocity:   { page: '/contact' },
        tekion:          { page: '/(contact|contact-us)' },
        tradepending:    { page: '/contact' },
        dealer_socket:   { page: '/(contact|contact-us|location)' },
        vehiso:          { page: '/(contact|contact-us)' },
      },
    },

    /* Content */

    blogs: {
      label: 'Blog / News',
      providers: {
        autorevo:        { page: '/(blog|news)' },
        dealer_inspire:  { page: '/blog' },
        dealer_com:      { page: '/(blog|news|articles|content)' },
        dealerclick:     { page: '/(blog|news)' },
        dealeron:        { page: '/(blog|news)' },
        dealer_eprocess: { page: '/(blog|news)' },
        cdk_global:      { page: '/(blog|news)' },
        car_research:    { page: '/blog' },
        dominion:        { page: '/blog' },
        edealer:         { page: '/blog' },
        flick_fusion:    { page: '/blog' },
        fox_dealer:      { page: '/(blog|news)' },
        heyauto:         { page: '/(blog|news)' },
        izmocars:        { page: '/(blog|news)' },
        motordesk:       { page: '/(blog|news)' },
        naked_lime:      { page: '/(blog|news)' },
        overfuel:        { page: '/(blog|news|articles|content)' },
        reynolds_web:    { page: '/(blog|news)' },
        sincro:          { page: '/blog' },
        spyne:           { page: '/(blog|news)' },
        stream_companies: { page: '/(blog|news)' },
        team_velocity:   { page: '/blog' },
        tekion:          { page: '/content/blog' },
        tradepending:    { page: '/blog' },
        dealer_socket:   { page: '/blog' },
        vehiso:          { page: '/(blog|news)' },
      },
    },

    model_research: {
      label: 'Model Research',
      providers: {
        autorevo:        { page: '/(research|models)' },
        dealer_inspire:  { page: '/research-models' },
        dealer_com:      { page: '/research' },
        dealerclick:     { page: '/(research|models)' },
        dealeron:        { page: '/(research|models)' },
        dealer_eprocess: { page: '/(research|models)' },
        cdk_global:      { page: '/(research|models)' },
        car_research:    { page: '/research' },
        dominion:        { page: '/research' },
        edealer:         { page: '/research' },
        flick_fusion:    { page: '/research' },
        fox_dealer:      { page: '/(research|models)' },
        heyauto:         { page: '/(research|models)' },
        izmocars:        { page: '/(research|models)' },
        motordesk:       { page: '/(research|models)' },
        naked_lime:      { page: '/(research|models)' },
        overfuel:        { page: '/research' },
        reynolds_web:    { page: '/(research|models)' },
        sincro:          { page: '/research' },
        spyne:           { page: '/(research|models)' },
        stream_companies: { page: '/(research|models)' },
        team_velocity:   { page: '/model-research' },
        tekion:          { page: '/research' },
        tradepending:    { page: '/research' },
        dealer_socket:   { page: '/model-research' },
        vehiso:          { page: '/(research|models)' },
      },
    },

    /* Vehicles / Parts */

    parts: {
      label: 'Parts / Accessories',
      providers: {
        autorevo:        { page: '/(parts|accessories)' },
        dealer_inspire:  { page: '/(parts|accessories|oe-parts)' },
        dealer_com:      { page: '/(parts|accessories)' },
        dealerclick:     { page: '/(parts|accessories)' },
        dealeron:        { page: '/(parts|accessories)' },
        dealer_eprocess: { page: '/(parts|accessories)' },
        cdk_global:      { page: '/(parts|accessories)' },
        car_research:    { page: '/parts' },
        dominion:        { page: '/parts' },
        edealer:         { page: '/parts' },
        flick_fusion:    { page: '/parts' },
        fox_dealer:      { page: '/(parts|accessories)' },
        heyauto:         { page: '/(parts|accessories)' },
        izmocars:        { page: '/(parts|accessories)' },
        motordesk:       { page: '/(parts|accessories)' },
        naked_lime:      { page: '/(parts|accessories)' },
        overfuel:        { page: '/(parts|accessories)' },
        reynolds_web:    { page: '/(parts|accessories)' },
        sincro:          { page: '/parts' },
        spyne:           { page: '/(parts|accessories)' },
        stream_companies: { page: '/(parts|accessories)' },
        team_velocity:   { page: '/parts' },
        tekion:          { page: '/parts' },
        tradepending:    { page: '/parts' },
        dealer_socket:   { page: '/parts' },
        vehiso:          { page: '/(parts|accessories)' },
      },
    },

  },

  tags: {
    vdp: {
      label: 'Vehicle Detail Page',
      // Anchored to avoid matching /service-details/, /contract-details/, etc. Requires word boundary or slash after.
      pattern: '/(viewdetails|vdp|VehicleDetails|vehicle-details|vehicle-detail)/|/detail(?:/|\\?|$)',
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
      // Anchor to path segment: require slash before and slash/query/end after to avoid matching in hostnames or query strings
      pattern: '/[A-HJ-NPR-Z0-9]{17}(?:/|\\?|$)',
    },
    queryable: {
      label: 'Query Parameter Based',
      pattern: '\\?.*=(new|used|certified)',
    },
  },

};
