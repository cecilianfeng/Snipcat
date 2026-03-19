/**
 * Gmail Inbox Scanner for SnipKitty (V6)
 *
 * Strategy: Frequency Analysis + Multi-currency + Stripe intermediary + PDF parsing
 * Phase 1: Search Gmail for billing/receipt/membership emails (metadata only, 3yr range)
 * Phase 2: Group by sender root domain (with intermediary domain resolution)
 * Phase 3: Frequency analysis — recurring senders + unknown brands with billing evidence pass
 * Phase 4: Fetch full email body + PDF attachments, extract price & details
 *
 * V6 changes:
 * - Expanded search keywords (membership, tax invoice, subscription confirmation, etc.)
 * - 3-year scan range (was 6 months) for better yearly detection
 * - Unknown brands with billing evidence now detected (not just known list)
 * - Improved frequency analysis with median-based interval detection
 * - Better Apple App Store parsing (Subscription Renewal + Receipt formats)
 * - Single-email services flagged for user confirmation
 * - "Pending/upcoming" status for subscriptions not yet charged
 *
 * Scope: SaaS software, streaming, web/app subscriptions only.
 * Excluded: utilities, insurance, gym, physical storage, retail.
 */

const GMAIL_API = 'https://www.googleapis.com/gmail/v1/users/me'

// ─── KNOWN SUBSCRIPTION SERVICES ───
// Matched by sender root domain. For multi-product domains (apple.com, google.com, etc.)
// we also check subject keywords.
const KNOWN_SUBSCRIPTIONS = {
  // ── AI Tools ──
  'openai.com':        { name: 'ChatGPT Plus', category: 'ai-tools', logo: 'openai.com' },
  'anthropic.com':     { name: 'Claude Pro', category: 'ai-tools', logo: 'claude.ai' },
  'claude.ai':         { name: 'Claude Pro', category: 'ai-tools', logo: 'claude.ai' },
  'midjourney.com':    { name: 'Midjourney', category: 'ai-tools', logo: 'midjourney.com' },
  'cursor.com':        { name: 'Cursor', category: 'ai-tools', logo: 'cursor.com' },
  'cursor.sh':         { name: 'Cursor', category: 'ai-tools', logo: 'cursor.com' },
  'perplexity.ai':     { name: 'Perplexity', category: 'ai-tools', logo: 'perplexity.ai' },
  'jasper.ai':         { name: 'Jasper AI', category: 'ai-tools', logo: 'jasper.ai' },
  'runwayml.com':      { name: 'Runway', category: 'ai-tools', logo: 'runwayml.com' },
  'elevenlabs.io':     { name: 'ElevenLabs', category: 'ai-tools', logo: 'elevenlabs.io' },
  'pika.art':          { name: 'Pika', category: 'ai-tools', logo: 'pika.art' },
  'lumalabs.ai':       { name: 'Luma AI', category: 'ai-tools', logo: 'lumalabs.ai' },
  'suno.com':          { name: 'Suno', category: 'ai-tools', logo: 'suno.com' },
  'suno.ai':           { name: 'Suno', category: 'ai-tools', logo: 'suno.com' },
  'udio.com':          { name: 'Udio', category: 'ai-tools', logo: 'udio.com' },
  'v0.dev':            { name: 'v0', category: 'ai-tools', logo: 'v0.dev' },
  'bolt.new':          { name: 'Bolt', category: 'ai-tools', logo: 'bolt.new' },
  'lovable.dev':       { name: 'Lovable', category: 'ai-tools', logo: 'lovable.dev' },
  'codeium.com':       { name: 'Windsurf', category: 'ai-tools', logo: 'codeium.com' },
  'windsurf.com':      { name: 'Windsurf', category: 'ai-tools', logo: 'windsurf.com' },
  'copy.ai':           { name: 'Copy.ai', category: 'ai-tools', logo: 'copy.ai' },
  'writesonic.com':    { name: 'Writesonic', category: 'ai-tools', logo: 'writesonic.com' },
  'synthesia.io':      { name: 'Synthesia', category: 'ai-tools', logo: 'synthesia.io' },
  'heygen.com':        { name: 'HeyGen', category: 'ai-tools', logo: 'heygen.com' },
  'descript.com':      { name: 'Descript', category: 'ai-tools', logo: 'descript.com' },
  'fathom.video':      { name: 'Fathom', category: 'ai-tools', logo: 'fathom.video' },
  'otter.ai':          { name: 'Otter.ai', category: 'ai-tools', logo: 'otter.ai' },
  'character.ai':      { name: 'Character.ai', category: 'ai-tools', logo: 'character.ai' },
  'magai.co':          { name: 'Magai', category: 'ai-tools', logo: 'magai.co' },
  'replit.com':        { name: 'Replit', category: 'ai-tools', logo: 'replit.com' },

  // ── Entertainment / Video Streaming ──
  'netflix.com':         { name: 'Netflix', category: 'entertainment', logo: 'netflix.com' },
  'disneyplus.com':      { name: 'Disney+', category: 'entertainment', logo: 'disneyplus.com' },
  'hulu.com':            { name: 'Hulu', category: 'entertainment', logo: 'hulu.com' },
  'max.com':             { name: 'Max', category: 'entertainment', logo: 'max.com' },
  'hbomax.com':          { name: 'Max', category: 'entertainment', logo: 'max.com' },
  'paramountplus.com':   { name: 'Paramount+', category: 'entertainment', logo: 'paramountplus.com' },
  'peacocktv.com':       { name: 'Peacock', category: 'entertainment', logo: 'peacocktv.com' },
  'crunchyroll.com':     { name: 'Crunchyroll', category: 'entertainment', logo: 'crunchyroll.com' },
  'primevideo.com':      { name: 'Amazon Prime Video', category: 'entertainment', logo: 'primevideo.com' },
  'crave.ca':            { name: 'Crave', category: 'entertainment', logo: 'crave.ca' },
  'mubi.com':            { name: 'Mubi', category: 'entertainment', logo: 'mubi.com' },
  'criterionchannel.com': { name: 'Criterion Channel', category: 'entertainment', logo: 'criterionchannel.com' },
  'curiositystream.com': { name: 'Curiosity Stream', category: 'entertainment', logo: 'curiositystream.com' },
  'shudder.com':         { name: 'Shudder', category: 'entertainment', logo: 'shudder.com' },
  'britbox.com':         { name: 'BritBox', category: 'entertainment', logo: 'britbox.com' },
  'viki.com':            { name: 'Viki', category: 'entertainment', logo: 'viki.com' },
  'funimation.com':      { name: 'Funimation', category: 'entertainment', logo: 'funimation.com' },
  'dazn.com':            { name: 'DAZN', category: 'entertainment', logo: 'dazn.com' },
  'espn.com':            { name: 'ESPN+', category: 'entertainment', logo: 'espn.com' },
  'espnplus.com':        { name: 'ESPN+', category: 'entertainment', logo: 'espn.com' },
  'fubo.tv':             { name: 'fuboTV', category: 'entertainment', logo: 'fubo.tv' },
  'sling.com':           { name: 'Sling TV', category: 'entertainment', logo: 'sling.com' },
  'twitch.tv':           { name: 'Twitch', category: 'entertainment', logo: 'twitch.tv' },

  // ── Music & Audio ──
  'spotify.com':       { name: 'Spotify', category: 'music', logo: 'spotify.com' },
  'tidal.com':         { name: 'Tidal', category: 'music', logo: 'tidal.com' },
  'deezer.com':        { name: 'Deezer', category: 'music', logo: 'deezer.com' },
  'soundcloud.com':    { name: 'SoundCloud Go', category: 'music', logo: 'soundcloud.com' },
  'audible.com':       { name: 'Audible', category: 'music', logo: 'audible.com' },
  'pocketcasts.com':   { name: 'Pocket Casts', category: 'music', logo: 'pocketcasts.com' },
  'pandora.com':       { name: 'Pandora', category: 'music', logo: 'pandora.com' },
  'siriusxm.com':      { name: 'SiriusXM', category: 'music', logo: 'siriusxm.com' },
  'qobuz.com':         { name: 'Qobuz', category: 'music', logo: 'qobuz.com' },

  // ── Gaming ──
  'playstation.com':   { name: 'PlayStation Plus', category: 'gaming', logo: 'playstation.com' },
  'sonyentertainmentnetwork.com': { name: 'PlayStation Plus', category: 'gaming', logo: 'playstation.com' },
  'ea.com':            { name: 'EA Play', category: 'gaming', logo: 'ea.com' },
  'ubisoft.com':       { name: 'Ubisoft+', category: 'gaming', logo: 'ubisoft.com' },
  'steampowered.com':  { name: 'Steam', category: 'gaming', logo: 'steampowered.com' },
  'humblebundle.com':  { name: 'Humble Bundle', category: 'gaming', logo: 'humblebundle.com' },
  'roblox.com':        { name: 'Roblox Premium', category: 'gaming', logo: 'roblox.com' },

  // ── Productivity & Workspace ──
  'notion.so':         { name: 'Notion', category: 'productivity', logo: 'notion.so' },
  'slack.com':         { name: 'Slack', category: 'productivity', logo: 'slack.com' },
  'zoom.us':           { name: 'Zoom', category: 'productivity', logo: 'zoom.us' },
  'canva.com':         { name: 'Canva', category: 'productivity', logo: 'canva.com' },
  'adobe.com':         { name: 'Adobe Creative Cloud', category: 'productivity', logo: 'adobe.com' },
  'grammarly.com':     { name: 'Grammarly', category: 'productivity', logo: 'grammarly.com' },
  'todoist.com':       { name: 'Todoist', category: 'productivity', logo: 'todoist.com' },
  'evernote.com':      { name: 'Evernote', category: 'productivity', logo: 'evernote.com' },
  'linear.app':        { name: 'Linear', category: 'productivity', logo: 'linear.app' },
  'obsidian.md':       { name: 'Obsidian', category: 'productivity', logo: 'obsidian.md' },
  'coda.io':           { name: 'Coda', category: 'productivity', logo: 'coda.io' },
  'airtable.com':      { name: 'Airtable', category: 'productivity', logo: 'airtable.com' },
  'monday.com':        { name: 'Monday.com', category: 'productivity', logo: 'monday.com' },
  'asana.com':         { name: 'Asana', category: 'productivity', logo: 'asana.com' },
  'clickup.com':       { name: 'ClickUp', category: 'productivity', logo: 'clickup.com' },
  'trello.com':        { name: 'Trello', category: 'productivity', logo: 'trello.com' },
  'miro.com':          { name: 'Miro', category: 'productivity', logo: 'miro.com' },
  'loom.com':          { name: 'Loom', category: 'productivity', logo: 'loom.com' },
  'calendly.com':      { name: 'Calendly', category: 'productivity', logo: 'calendly.com' },
  'zapier.com':        { name: 'Zapier', category: 'productivity', logo: 'zapier.com' },
  'make.com':          { name: 'Make', category: 'productivity', logo: 'make.com' },
  'ifttt.com':         { name: 'IFTTT', category: 'productivity', logo: 'ifttt.com' },
  'superhuman.com':    { name: 'Superhuman', category: 'productivity', logo: 'superhuman.com' },

  // ── Developer Tools ──
  'github.com':        { name: 'GitHub', category: 'developer-tools', logo: 'github.com' },
  'gitlab.com':        { name: 'GitLab', category: 'developer-tools', logo: 'gitlab.com' },
  'figma.com':         { name: 'Figma', category: 'developer-tools', logo: 'figma.com' },
  'vercel.com':        { name: 'Vercel', category: 'developer-tools', logo: 'vercel.com' },
  'netlify.com':       { name: 'Netlify', category: 'developer-tools', logo: 'netlify.com' },
  'heroku.com':        { name: 'Heroku', category: 'developer-tools', logo: 'heroku.com' },
  'digitalocean.com':  { name: 'DigitalOcean', category: 'developer-tools', logo: 'digitalocean.com' },
  'railway.app':       { name: 'Railway', category: 'developer-tools', logo: 'railway.app' },
  'render.com':        { name: 'Render', category: 'developer-tools', logo: 'render.com' },
  'supabase.com':      { name: 'Supabase', category: 'developer-tools', logo: 'supabase.com' },
  'supabase.io':       { name: 'Supabase', category: 'developer-tools', logo: 'supabase.com' },
  'postman.com':       { name: 'Postman', category: 'developer-tools', logo: 'postman.com' },
  'jetbrains.com':     { name: 'JetBrains', category: 'developer-tools', logo: 'jetbrains.com' },
  'cloudflare.com':    { name: 'Cloudflare', category: 'developer-tools', logo: 'cloudflare.com' },
  'mongodb.com':       { name: 'MongoDB Atlas', category: 'developer-tools', logo: 'mongodb.com' },
  'planetscale.com':   { name: 'PlanetScale', category: 'developer-tools', logo: 'planetscale.com' },
  'fly.io':            { name: 'Fly.io', category: 'developer-tools', logo: 'fly.io' },
  'docker.com':        { name: 'Docker', category: 'developer-tools', logo: 'docker.com' },
  'sentry.io':         { name: 'Sentry', category: 'developer-tools', logo: 'sentry.io' },
  'circleci.com':      { name: 'CircleCI', category: 'developer-tools', logo: 'circleci.com' },
  'algolia.com':       { name: 'Algolia', category: 'developer-tools', logo: 'algolia.com' },
  'twilio.com':        { name: 'Twilio', category: 'developer-tools', logo: 'twilio.com' },
  'sendgrid.com':      { name: 'SendGrid', category: 'developer-tools', logo: 'sendgrid.com' },

  // ── Design & Creative ──
  'brandcrowd.com':    { name: 'BrandCrowd', category: 'design', logo: 'brandcrowd.com' },
  'sketch.com':        { name: 'Sketch', category: 'design', logo: 'sketch.com' },
  'invisionapp.com':   { name: 'InVision', category: 'design', logo: 'invisionapp.com' },
  'framer.com':        { name: 'Framer', category: 'design', logo: 'framer.com' },
  'webflow.com':       { name: 'Webflow', category: 'design', logo: 'webflow.com' },
  'spline.design':     { name: 'Spline', category: 'design', logo: 'spline.design' },
  'protopie.io':       { name: 'ProtoPie', category: 'design', logo: 'protopie.io' },
  'envato.com':        { name: 'Envato Elements', category: 'design', logo: 'envato.com' },
  'creativemarket.com': { name: 'Creative Market', category: 'design', logo: 'creativemarket.com' },
  'jitter.video':      { name: 'Jitter', category: 'design', logo: 'jitter.video' },
  'snackthis.co':      { name: 'Jitter', category: 'design', logo: 'jitter.video' },

  // ── Cloud Storage & Backup ──
  'dropbox.com':       { name: 'Dropbox', category: 'cloud-storage', logo: 'dropbox.com' },
  'box.com':           { name: 'Box', category: 'cloud-storage', logo: 'box.com' },
  'pcloud.com':        { name: 'pCloud', category: 'cloud-storage', logo: 'pcloud.com' },
  'backblaze.com':     { name: 'Backblaze', category: 'cloud-storage', logo: 'backblaze.com' },
  'idrive.com':        { name: 'IDrive', category: 'cloud-storage', logo: 'idrive.com' },
  'sync.com':          { name: 'Sync.com', category: 'cloud-storage', logo: 'sync.com' },
  'mega.nz':           { name: 'MEGA', category: 'cloud-storage', logo: 'mega.nz' },
  'mega.io':           { name: 'MEGA', category: 'cloud-storage', logo: 'mega.nz' },

  // ── VPN & Security ──
  'nordvpn.com':       { name: 'NordVPN', category: 'security', logo: 'nordvpn.com' },
  'expressvpn.com':    { name: 'ExpressVPN', category: 'security', logo: 'expressvpn.com' },
  'surfshark.com':     { name: 'Surfshark', category: 'security', logo: 'surfshark.com' },
  'protonvpn.com':     { name: 'ProtonVPN', category: 'security', logo: 'protonvpn.com' },
  'proton.me':         { name: 'Proton', category: 'security', logo: 'proton.me' },
  '1password.com':     { name: '1Password', category: 'security', logo: '1password.com' },
  'lastpass.com':      { name: 'LastPass', category: 'security', logo: 'lastpass.com' },
  'bitwarden.com':     { name: 'Bitwarden', category: 'security', logo: 'bitwarden.com' },
  'dashlane.com':      { name: 'Dashlane', category: 'security', logo: 'dashlane.com' },
  'mullvad.net':       { name: 'Mullvad VPN', category: 'security', logo: 'mullvad.net' },
  'privateinternetaccess.com': { name: 'Private Internet Access', category: 'security', logo: 'privateinternetaccess.com' },
  'cyberghostvpn.com': { name: 'CyberGhost', category: 'security', logo: 'cyberghostvpn.com' },
  'windscribe.com':    { name: 'Windscribe', category: 'security', logo: 'windscribe.com' },
  'nordpass.com':      { name: 'NordPass', category: 'security', logo: 'nordpass.com' },
  'keepersecurity.com': { name: 'Keeper', category: 'security', logo: 'keepersecurity.com' },

  // ── Education & Learning ──
  'duolingo.com':      { name: 'Duolingo Plus', category: 'education', logo: 'duolingo.com' },
  'coursera.org':      { name: 'Coursera', category: 'education', logo: 'coursera.org' },
  'skillshare.com':    { name: 'Skillshare', category: 'education', logo: 'skillshare.com' },
  'masterclass.com':   { name: 'MasterClass', category: 'education', logo: 'masterclass.com' },
  'brilliant.org':     { name: 'Brilliant', category: 'education', logo: 'brilliant.org' },
  'udemy.com':         { name: 'Udemy', category: 'education', logo: 'udemy.com' },
  'linkedin.com':      { name: 'LinkedIn Learning', category: 'education', logo: 'linkedin.com' },
  'codecademy.com':    { name: 'Codecademy', category: 'education', logo: 'codecademy.com' },
  'datacamp.com':      { name: 'DataCamp', category: 'education', logo: 'datacamp.com' },
  'pluralsight.com':   { name: 'Pluralsight', category: 'education', logo: 'pluralsight.com' },
  'blinkist.com':      { name: 'Blinkist', category: 'education', logo: 'blinkist.com' },
  'babbel.com':        { name: 'Babbel', category: 'education', logo: 'babbel.com' },
  'rosettastone.com':  { name: 'Rosetta Stone', category: 'education', logo: 'rosettastone.com' },
  'wondrium.com':      { name: 'Wondrium', category: 'education', logo: 'wondrium.com' },

  // ── Health & Fitness ──
  'headspace.com':     { name: 'Headspace', category: 'health', logo: 'headspace.com' },
  'calm.com':          { name: 'Calm', category: 'health', logo: 'calm.com' },
  'onepeloton.com':    { name: 'Peloton', category: 'health', logo: 'onepeloton.com' },
  'strava.com':        { name: 'Strava', category: 'health', logo: 'strava.com' },
  'myfitnesspal.com':  { name: 'MyFitnessPal', category: 'health', logo: 'myfitnesspal.com' },
  'noom.com':          { name: 'Noom', category: 'health', logo: 'noom.com' },
  'fitbod.me':         { name: 'Fitbod', category: 'health', logo: 'fitbod.me' },
  'whoop.com':         { name: 'Whoop', category: 'health', logo: 'whoop.com' },
  'freeletics.com':    { name: 'Freeletics', category: 'health', logo: 'freeletics.com' },
  'zwift.com':         { name: 'Zwift', category: 'health', logo: 'zwift.com' },
  'ouraring.com':      { name: 'Oura Ring', category: 'health', logo: 'ouraring.com' },
  'flo.health':        { name: 'Flo', category: 'health', logo: 'flo.health' },
  'betterhelp.com':    { name: 'BetterHelp', category: 'health', logo: 'betterhelp.com' },

  // ── News & Media ──
  'medium.com':        { name: 'Medium', category: 'news', logo: 'medium.com' },
  'substack.com':      { name: 'Substack', category: 'news', logo: 'substack.com' },
  'nytimes.com':       { name: 'New York Times', category: 'news', logo: 'nytimes.com' },
  'washingtonpost.com': { name: 'Washington Post', category: 'news', logo: 'washingtonpost.com' },
  'theathletic.com':   { name: 'The Athletic', category: 'news', logo: 'theathletic.com' },
  'wsj.com':           { name: 'Wall Street Journal', category: 'news', logo: 'wsj.com' },
  'economist.com':     { name: 'The Economist', category: 'news', logo: 'economist.com' },
  'bloomberg.com':     { name: 'Bloomberg', category: 'news', logo: 'bloomberg.com' },
  'ft.com':            { name: 'Financial Times', category: 'news', logo: 'ft.com' },
  'theinformation.com': { name: 'The Information', category: 'news', logo: 'theinformation.com' },
  'wired.com':         { name: 'Wired', category: 'news', logo: 'wired.com' },
  'stratechery.com':   { name: 'Stratechery', category: 'news', logo: 'stratechery.com' },
  'theglobeandmail.com': { name: 'Globe and Mail', category: 'news', logo: 'theglobeandmail.com' },
  'thestar.com':       { name: 'Toronto Star', category: 'news', logo: 'thestar.com' },

  // ── Communication & Social ──
  'discord.com':       { name: 'Discord Nitro', category: 'social', logo: 'discord.com' },
  'discordapp.com':    { name: 'Discord Nitro', category: 'social', logo: 'discord.com' },
  'telegram.org':      { name: 'Telegram Premium', category: 'social', logo: 'telegram.org' },
  'x.com':             { name: 'X Premium', category: 'social', logo: 'x.com' },
  'twitter.com':       { name: 'X Premium', category: 'social', logo: 'x.com' },
  'reddit.com':        { name: 'Reddit Premium', category: 'social', logo: 'reddit.com' },
  'redditmail.com':    { name: 'Reddit Premium', category: 'social', logo: 'reddit.com' },
  'patreon.com':       { name: 'Patreon', category: 'social', logo: 'patreon.com' },
  'buymeacoffee.com':  { name: 'Buy Me a Coffee', category: 'social', logo: 'buymeacoffee.com' },
  'beehiiv.com':       { name: 'Beehiiv', category: 'social', logo: 'beehiiv.com' },
  'convertkit.com':    { name: 'ConvertKit', category: 'social', logo: 'convertkit.com' },

  // ── Domain & Hosting ──
  'namecheap.com':     { name: 'Namecheap', category: 'hosting', logo: 'namecheap.com' },
  'godaddy.com':       { name: 'GoDaddy', category: 'hosting', logo: 'godaddy.com' },
  'squarespace.com':   { name: 'Squarespace', category: 'hosting', logo: 'squarespace.com' },
  'wix.com':           { name: 'Wix', category: 'hosting', logo: 'wix.com' },
  'wordpress.com':     { name: 'WordPress.com', category: 'hosting', logo: 'wordpress.com' },
  'shopify.com':       { name: 'Shopify', category: 'hosting', logo: 'shopify.com' },
  'ghost.org':         { name: 'Ghost', category: 'hosting', logo: 'ghost.org' },
}

// ── Multi-product domains: need subject keyword to identify specific service ──
const MULTI_PRODUCT_DOMAINS = {
  'apple.com': [
    { keywords: ['apple tv', 'tv+'], name: 'Apple TV+', category: 'entertainment', logo: 'tv.apple.com' },
    { keywords: ['apple music', 'music subscription'], name: 'Apple Music', category: 'music', logo: 'music.apple.com' },
    { keywords: ['icloud', 'storage plan'], name: 'iCloud+', category: 'cloud-storage', logo: 'icloud.com' },
    { keywords: ['arcade'], name: 'Apple Arcade', category: 'gaming', logo: 'apple.com' },
    { keywords: ['fitness+', 'fitness'], name: 'Apple Fitness+', category: 'health', logo: 'apple.com' },
    { keywords: ['apple one'], name: 'Apple One', category: 'entertainment', logo: 'apple.com' },
    // App Store receipts — catch-all for subscription receipts from App Store
    { keywords: ['app store', 'receipt', '收据', 'subscription confirmation', 'renewal', 'renews'], name: 'App Store', category: 'entertainment', logo: 'apple.com' },
  ],
  'google.com': [
    { keywords: ['google one', 'storage plan'], name: 'Google One', category: 'cloud-storage', logo: 'one.google.com' },
    { keywords: ['youtube premium', 'yt premium'], name: 'YouTube Premium', category: 'entertainment', logo: 'youtube.com' },
    { keywords: ['youtube music'], name: 'YouTube Music', category: 'music', logo: 'music.youtube.com' },
    { keywords: ['google workspace', 'workspace'], name: 'Google Workspace', category: 'productivity', logo: 'workspace.google.com' },
    { keywords: ['play pass'], name: 'Google Play Pass', category: 'gaming', logo: 'play.google.com' },
    { keywords: ['google play', 'play store', 'play order'], name: 'Google Play', category: 'entertainment', logo: 'play.google.com' },
    { keywords: ['gemini', 'ai pro'], name: 'Google Gemini', category: 'ai-tools', logo: 'gemini.google.com' },
  ],
  'amazon.com': [
    { keywords: ['prime video'], name: 'Amazon Prime Video', category: 'entertainment', logo: 'primevideo.com' },
    { keywords: ['prime membership', 'amazon prime', 'prime has been renewed'], name: 'Amazon Prime', category: 'entertainment', logo: 'amazon.com' },
    { keywords: ['amazon music', 'music unlimited'], name: 'Amazon Music', category: 'music', logo: 'music.amazon.com' },
    { keywords: ['audible'], name: 'Audible', category: 'music', logo: 'audible.com' },
    { keywords: ['kindle unlimited'], name: 'Kindle Unlimited', category: 'education', logo: 'amazon.com' },
    { keywords: ['aws', 'amazon web services'], name: 'AWS', category: 'developer-tools', logo: 'aws.amazon.com' },
  ],
  'microsoft.com': [
    { keywords: ['365', 'office'], name: 'Microsoft 365', category: 'productivity', logo: 'microsoft.com' },
    { keywords: ['game pass', 'xbox'], name: 'Xbox Game Pass', category: 'gaming', logo: 'xbox.com' },
    { keywords: ['onedrive'], name: 'OneDrive', category: 'cloud-storage', logo: 'onedrive.com' },
    { keywords: ['azure'], name: 'Azure', category: 'developer-tools', logo: 'azure.microsoft.com' },
    { keywords: ['copilot'], name: 'Microsoft Copilot', category: 'ai-tools', logo: 'copilot.microsoft.com' },
  ],
  'nintendo.com': [
    { keywords: ['switch online', 'online membership'], name: 'Nintendo Switch Online', category: 'gaming', logo: 'nintendo.com' },
  ],
  'xbox.com': [
    { keywords: ['game pass'], name: 'Xbox Game Pass', category: 'gaming', logo: 'xbox.com' },
    { keywords: ['gold', 'live'], name: 'Xbox Live Gold', category: 'gaming', logo: 'xbox.com' },
  ],
  'nvidia.com': [
    { keywords: ['geforce now'], name: 'GeForce NOW', category: 'gaming', logo: 'nvidia.com' },
  ],
}

// ─── INTERMEDIARY BILLING DOMAINS ───
// These domains send receipts on behalf of other companies (e.g., Stripe)
const INTERMEDIARY_DOMAINS = ['stripe.com']

// ─── PLATFORM DOMAINS: services where we need sub-product/creator name ───
// These are platforms where users subscribe to specific content/creators/plugins,
// not just the platform itself. We extract the specific name to show:
// "Lenny's Newsletter (via Substack)" instead of just "Substack"
const PLATFORM_DOMAINS = {
  'substack.com': {
    platform: 'Substack',
    category: 'news',
    logo: 'substack.com',
    // Extract creator name from From header: "Lenny's Newsletter <lenny@substack.com>"
    extractFromHeader: true,
    // Extract from subject: "Your payment receipt from Lenny's Newsletter"
    subjectPatterns: [
      /receipt from\s+(.+?)(?:\s*#|\s*$)/i,
      /from\s+(.+?)(?:'s Newsletter|'s Podcast|\s*#|\s*$)/i,
    ],
  },
  'patreon.com': {
    platform: 'Patreon',
    category: 'social',
    logo: 'patreon.com',
    extractFromHeader: true,
    subjectPatterns: [
      /receipt.*?from\s+(.+?)(?:\s*$|\s*#)/i,
      /(?:pledge|subscription)\s+(?:to|for)\s+(.+?)(?:\s*$|\s*#)/i,
    ],
  },
  'medium.com': {
    platform: 'Medium',
    category: 'news',
    logo: 'medium.com',
    extractFromHeader: false,
    subjectPatterns: [], // Medium membership is platform-wide, no sub-product
  },
  'buymeacoffee.com': {
    platform: 'Buy Me a Coffee',
    category: 'social',
    logo: 'buymeacoffee.com',
    extractFromHeader: true,
    subjectPatterns: [
      /membership.*?for\s+(.+?)(?:\s*$)/i,
    ],
  },
}

/**
 * Extract sub-product/creator name from platform domain emails.
 * Returns specific name or null (falls back to platform name).
 */
function extractPlatformSubName(domain, from, subject, bodyText) {
  const platformInfo = PLATFORM_DOMAINS[domain]
  if (!platformInfo) return null

  // Strategy 1: Extract from "From" header display name
  // e.g., "Lenny's Newsletter <lenny@substack.com>" → "Lenny's Newsletter"
  if (platformInfo.extractFromHeader) {
    const nameMatch = from.match(/^"?([^"<]+)"?\s*</)
    if (nameMatch) {
      const displayName = nameMatch[1].trim()
      // Skip if it's just the platform name or generic words
      const skip = ['noreply', 'billing', 'no-reply', 'receipt', 'support', 'payments',
        'team', 'hello', 'notifications', platformInfo.platform.toLowerCase()]
      if (!skip.some(s => displayName.toLowerCase().includes(s)) && displayName.length > 1) {
        return displayName
      }
    }
  }

  // Strategy 2: Extract from subject using platform-specific patterns
  if (platformInfo.subjectPatterns) {
    for (const pattern of platformInfo.subjectPatterns) {
      const match = subject.match(pattern)
      if (match) {
        let name = match[1].trim()
          .replace(/[#\-–—]\s*\d+.*$/, '') // remove invoice numbers
          .replace(/\s*(?:Inc|LLC|Ltd|B\.V\.).*$/i, '')
          .trim()
        if (name.length > 1 && name.length < 80) return name
      }
    }
  }

  // Strategy 3: Extract from body text
  if (bodyText) {
    const bodyPatterns = [
      // "Receipt from Lenny's Newsletter" / "Payment receipt from ..."
      /(?:payment\s+)?receipt\s+from\s+(.+?)(?:\s*Thank|\s*\n|\.\s|#\d)/im,
      // "Your subscription to Lenny's Newsletter"
      /subscription\s+to\s+(.+?)(?:\s+has|\s+is|\s+was|\s*\n|\.\s)/im,
      // "paid subscription" context: "Lenny's Newsletter paid subscription"
      /(.+?)\s+paid\s+subscription/im,
    ]
    for (const p of bodyPatterns) {
      const match = bodyText.match(p)
      if (match) {
        let name = match[1].trim().replace(/[.,]$/, '').trim()
        // Skip platform name itself
        if (name.toLowerCase() === platformInfo.platform.toLowerCase()) continue
        if (name.length > 1 && name.length < 80) return name
      }
    }
  }

  // Strategy 4: Extract from subject — generic "from X" pattern (broader)
  const fromMatch = subject.match(/from\s+(.+?)$/i)
  if (fromMatch) {
    let name = fromMatch[1].trim()
      .replace(/[#\-–—]\s*\d+.*$/, '')
      .replace(/\s*(?:Inc|LLC|Ltd|B\.V\.).*$/i, '')
      .trim()
    if (name.length > 1 && name.length < 80 && name.toLowerCase() !== platformInfo.platform.toLowerCase()) {
      return name
    }
  }

  return null
}

// ─── BLOCKLIST: Non-subscription recurring senders ───
const BLOCKLIST = [
  // Telecom / ISPs / Utilities
  'bell.ca', 'bell.net', 'rogers.com', 'telus.com', 'fido.ca', 'koodo.com',
  'virginmobile', 'virginplus', 'shaw.ca', 'att.com', 'att.net', 'verizon.com',
  'tmobile.com', 't-mobile.com', 'comcast.com', 'xfinity.com', 'spectrum.com',
  'hydroone', 'enbridge', 'fortisbc', 'bchydro', 'torontohydro', 'alectra',
  'puc.on.ca', 'hydroottawa', 'epcor.com', 'bge.com', 'coned.com', 'pge.com',
  'sce.com', 'duke-energy', 'nationalgrid', 'dominion', 'firstenergy',
  // Water utilities
  'toronto.ca', 'peelregion', 'york.ca', 'halton.ca', 'durham.ca',
  'regionofwaterloo', 'cityofhamilton', 'cityofottawa', 'cityofvancouver',
  // Insurance
  'equitable', 'sunlife', 'manulife', 'greatwest', 'desjardins',
  'statefarm', 'allstate', 'geico', 'progressive.com',
  'intact.net', 'cooperators', 'aviva.ca', 'td insurance',
  // Retailers / Shopping / Fashion
  'bestbuy', 'walmart', 'costco', 'target.com', 'ikea',
  'homedepot', 'lowes', 'staples', 'winners', 'marshalls',
  'aritzia', 'zara.com', 'hm.com', 'uniqlo', 'gap.com', 'oldnavy',
  'lululemon', 'oakandfort', 'oak+fort', 'sephora', 'ulta', 'nordstrom',
  'shein', 'fashionnova', 'ssense', 'farfetch', 'abercrombie',
  'arcteryx', 'arc\'teryx', 'ralphlauren', 'polo', 'alexanderwang',
  'urbanoutfitters', 'anthropologie', 'freepeople', 'jcrew', 'macys',
  'bloomingdales', 'saksfifth', 'neimanmarcus', 'coach.com', 'gucci',
  'prada', 'louisvuitton', 'lvmh', 'burberry', 'balenciaga', 'dior',
  'chanel.com', 'hermes.com', 'tiffany', 'cartier', 'rolex',
  'ladym', 'lady m', 'petsmart', 'petco', 'chewy.com',
  'indigo.ca', 'chapters.ca', 'bookdepository', 'bookroom',
  'asiabookroom', 'abebooks', 'thriftbooks',
  // Transportation / Airlines / Car
  'uber.com', 'lyft.com', 'turo.com', 'enterprise.com', 'hertz.com',
  '407etr', '407 etr', 'presto', 'transit', 'compass card',
  'aircanada', 'air canada', 'westjet', 'united.com', 'delta.com',
  'americanairlines', 'southwest', 'alaskaair', 'jetblue',
  'expedia.com', 'kayak.com', 'skyscanner', 'hopper.com',
  'flighthub', 'google flights',
  // Food / Restaurant / Delivery
  'doordash', 'ubereats', 'skipthedishes', 'grubhub', 'instacart',
  'hellofresh', 'goodfood', 'chefplate', 'freshprep',
  'starbucks', 'timhortons', 'mcdonalds', 'subway', 'dominos',
  // Banks / Finance
  'paypal.com', 'venmo.com', 'interac', 'scotiabank', 'tdbank', 'td.com',
  'rbc.com', 'rbcroyalbank', 'bmo.com', 'cibc.com',
  'americanexpress', 'chase.com', 'capitalone',
  'pcfinancial', 'simplii', 'tangerine', 'eq bank', 'wealthsimple',
  'questrade', 'interactive brokers',
  // Government
  'cra-arc', 'canada.ca', 'irs.gov', 'servicecanada', 'serviceontario',
  // Shipping
  'fedex.com', 'ups.com', 'usps.com', 'canadapost', 'dhl.com', 'purolator',
  // Travel / Hotels
  'airbnb.com', 'booking.com', 'expedia.com', 'hotels.com',
  'marriott', 'hilton', 'hyatt', 'ihg', 'bestwestern',
  'vrbo', 'tripadvisor',
  // Physical services (not SaaS)
  'accessstorage', 'storagemart', 'publicstore',
  // Real estate
  'zillow', 'realtor.com', 'redfin',
  // Education institutions (not SaaS)
  'brainstation', 'generalassemb', 'bootcamp', 'university', 'college',
  // Gmail itself
  'gmail.com',
]

// ─── STRONG SUBSCRIPTION INDICATORS ───
// For UNKNOWN brands (not in KNOWN_SUBSCRIPTIONS), we require these stronger
// signals. Generic words like "receipt" and "invoice" are NOT enough because
// shopping receipts also have those. Only pass unknown brands if the email
// contains one of these explicit subscription/recurring signals.
const STRONG_SUBSCRIPTION_KEYWORDS = [
  'subscription', 'membership', 'renewal', 'auto-renew', 'auto-renewal',
  'recurring', 'billing cycle', 'billing period', 'renew each',
  'monthly charge', 'annual charge', 'yearly plan', 'monthly plan',
  'your plan', 'plan renewal', 'auto renewing', 'subscription renewed',
  'subscriber', 'renews on', 'next billing', 'premium member',
  'pro plan', 'team plan', 'business plan', 'starter plan',
  '订阅', '会员', '续费', '自动续费', '连续包月', '连续包年',
]

/**
 * Check if email subject/text contains STRONG subscription signals.
 * This is stricter than hasBillingEvidence — used for unknown brands
 * to avoid false positives from shopping receipts.
 */
function hasStrongSubscriptionEvidence(text) {
  if (!text) return false
  const lower = text.toLowerCase()
  return STRONG_SUBSCRIPTION_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()))
}

// ─── BILLING / RECEIPT KEYWORDS (email must have at least one) ───
const BILLING_KEYWORDS = [
  'receipt', 'invoice', 'payment', 'charged', 'billing',
  'your bill', 'amount due', 'total:', 'transaction',
  'paid', 'charge of', 'payment of', 'debited',
  'subscription renew', 'renewal', 'auto-renew', 'recurring',
  'next billing', 'billing period', 'billing cycle',
  'payment confirmation', 'payment received', 'successfully charged',
  'your receipt', 'monthly charge', 'annual charge',
  'subscription', 'plan', 'charge', 'order', 'confirmation',
  'annual plan', 'yearly plan', 'membership', 'premium',
  'pro plan', 'team plan', 'business plan', 'starter plan',
  'tax invoice', 'your membership', 'welcome to your',
  'subscription confirmation', 'paid subscription', 'renew each',
  'auto-renewal', 'auto renewing', 'order receipt',
  '收据', '发票', '账单', '付款', '订阅', '会员', '续费', // Chinese billing keywords
]

// ─── ONE-TIME PURCHASE KEYWORDS ───
const ONE_TIME_KEYWORDS = [
  'order confirmation', 'order #', 'order number', 'shipping',
  'shipped', 'delivered', 'tracking number', 'track your',
  'your order', 'purchase confirmation', 'one-time', 'one time',
  'refund', 'exchange', 'warranty',
]

// ═══════════════════════════════════════════════════════
// GMAIL API HELPERS
// ═══════════════════════════════════════════════════════

/**
 * Search messages with pagination — returns ALL matching message IDs
 */
async function searchAllMessages(token, query, maxTotal = 500) {
  let allMessages = []
  let pageToken = null

  while (allMessages.length < maxTotal) {
    const params = new URLSearchParams({
      q: query,
      maxResults: Math.min(500, maxTotal - allMessages.length).toString(),
    })
    if (pageToken) params.set('pageToken', pageToken)

    const url = `${GMAIL_API}/messages?${params}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Gmail search failed: ${res.status} ${err}`)
    }

    const data = await res.json()
    if (data.messages) {
      allMessages = allMessages.concat(data.messages)
    }

    if (!data.nextPageToken || !data.messages) break
    pageToken = data.nextPageToken
  }

  return allMessages
}

/**
 * Get message metadata only (From, Subject, Date) — lightweight API call
 */
async function getMessageMetadata(token, messageId) {
  const url = `${GMAIL_API}/messages/${messageId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  return res.json()
}

/**
 * Get full message (for price extraction) — heavier API call
 */
async function getFullMessage(token, messageId) {
  const url = `${GMAIL_API}/messages/${messageId}?format=full`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  return res.json()
}

/**
 * Download email attachment by ID — returns base64 data
 */
async function getAttachment(token, messageId, attachmentId) {
  const url = `${GMAIL_API}/messages/${messageId}/attachments/${attachmentId}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.data // base64url encoded
}

function getHeader(message, name) {
  const header = message.payload?.headers?.find(
    h => h.name.toLowerCase() === name.toLowerCase()
  )
  return header?.value || ''
}

// ═══════════════════════════════════════════════════════
// DOMAIN & MATCHING HELPERS
// ═══════════════════════════════════════════════════════

/**
 * Extract root domain from From header
 * e.g., "noreply@billing.spotify.com" → "spotify.com"
 */
function extractRootDomain(from) {
  const match = from.match(/@([^\s>]+)/)
  if (!match) return ''
  const full = match[1].toLowerCase()
  const parts = full.split('.')
  if (parts.length <= 2) return full
  // Handle co.uk, com.au, etc.
  const twoPartTLDs = ['co.uk', 'com.au', 'co.jp', 'com.br', 'co.nz']
  const lastTwo = parts.slice(-2).join('.')
  if (twoPartTLDs.includes(lastTwo)) {
    return parts.slice(-3).join('.')
  }
  return parts.slice(-2).join('.')
}

/**
 * Check if a domain is an intermediary billing service (like Stripe)
 */
function isIntermediaryDomain(domain) {
  return INTERMEDIARY_DOMAINS.some(d => domain === d || domain.endsWith('.' + d))
}

/**
 * Extract the real service name from a Stripe/intermediary receipt email
 * Patterns: "Your receipt from Framer B.V." / "来自 Framer B.V. 的收据"
 */
function extractIntermediaryServiceInfo(subject, bodyText) {
  // Try subject first: "receipt from COMPANY" / "来自 COMPANY 的收据"
  const patterns = [
    /receipt from\s+(.+?)(?:\s*(?:#|（|\(|$))/i,
    /来自\s+(.+?)\s*的(?:收据|账单|发票)/,
    /from\s+(.+?),?\s*(?:PBC|Inc|LLC|Ltd|B\.V\.|GmbH|Co)?\s*(?:#|$)/i,
  ]

  for (const p of patterns) {
    const match = subject.match(p)
    if (match) {
      let name = match[1].trim().replace(/[,.]$/, '').trim()
      // Clean up suffixes
      name = name.replace(/\s*(?:,?\s*(?:PBC|Inc|LLC|Ltd|B\.V\.|GmbH|Co\.?))\s*$/i, '').trim()
      if (name.length > 1 && name.length < 60) return name
    }
  }

  // Try body text for company name near top
  if (bodyText) {
    const bodyPatterns = [
      /receipt from\s+(.+?)(?:\s*(?:CA?\$|US?\$|€|£|¥))/i,
      /来自\s+(.+?)\s*的/,
    ]
    for (const p of bodyPatterns) {
      const match = bodyText.match(p)
      if (match) {
        let name = match[1].trim().replace(/[,.]$/, '').trim()
        name = name.replace(/\s*(?:,?\s*(?:PBC|Inc|LLC|Ltd|B\.V\.|GmbH|Co\.?))\s*$/i, '').trim()
        if (name.length > 1 && name.length < 60) return name
      }
    }
  }

  return null
}

/**
 * Reverse-lookup: find a known service by name
 * Used to match intermediary-extracted names to our known list
 */
function findKnownServiceByName(serviceName) {
  if (!serviceName) return null
  const lower = serviceName.toLowerCase()

  for (const [domain, info] of Object.entries(KNOWN_SUBSCRIPTIONS)) {
    if (lower.includes(info.name.toLowerCase()) || info.name.toLowerCase().includes(lower)) {
      return { ...info, matchedDomain: domain }
    }
    // Also match on domain name (e.g., "Framer" matches framer.com)
    const domainBase = domain.split('.')[0]
    if (lower.includes(domainBase) || domainBase.includes(lower)) {
      return { ...info, matchedDomain: domain }
    }
  }
  return null
}

/**
 * Check if domain is blocklisted
 */
function isBlocklisted(domain, from, subject) {
  const fromLower = from.toLowerCase()
  const subjectLower = subject.toLowerCase()
  for (const blocked of BLOCKLIST) {
    if (domain.includes(blocked) || fromLower.includes(blocked) || subjectLower.includes(blocked)) {
      return true
    }
  }
  return false
}

/**
 * Match domain to known service (including multi-product domains)
 */
function matchKnownService(domain, subject) {
  // Check multi-product domains first
  for (const [mpDomain, products] of Object.entries(MULTI_PRODUCT_DOMAINS)) {
    if (domain === mpDomain || domain.endsWith('.' + mpDomain)) {
      const subLower = subject.toLowerCase()
      for (const product of products) {
        if (product.keywords.some(kw => subLower.includes(kw))) {
          return product
        }
      }
      // Domain matches but no specific product keyword found —
      // Return a generic entry so the email isn't dropped entirely.
      // Phase 4 will attempt to extract more details from the body.
      const domainBase = mpDomain.split('.')[0]
      return {
        name: domainBase.charAt(0).toUpperCase() + domainBase.slice(1),
        category: 'other',
        logo: mpDomain,
        _isGenericMultiProduct: true,
      }
    }
  }

  // Check regular known services
  for (const [serviceDomain, info] of Object.entries(KNOWN_SUBSCRIPTIONS)) {
    if (domain === serviceDomain || domain.endsWith('.' + serviceDomain)) {
      return info
    }
  }

  return null
}

// ═══════════════════════════════════════════════════════
// BODY DECODING & EXTRACTION
// ═══════════════════════════════════════════════════════

function decodeBody(payload) {
  let body = ''

  if (payload.body?.data) {
    try {
      body = atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'))
    } catch (e) { body = '' }
  }

  if (!body && payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        try {
          body = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'))
          break
        } catch (e) { /* skip */ }
      }
    }
    if (!body) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/html' && part.body?.data) {
          try {
            const html = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'))
            body = html
              .replace(/<\/(div|td|tr|p|li|h[1-6])>/gi, ' ')
              .replace(/<(br|hr)\s*\/?>/gi, ' ')
              .replace(/<[^>]+>/g, ' ')
              .replace(/&nbsp;/g, ' ')
              .replace(/\s+/g, ' ')
            break
          } catch (e) { /* skip */ }
        }
        if (part.parts) {
          for (const sub of part.parts) {
            if (sub.body?.data) {
              try {
                const decoded = atob(sub.body.data.replace(/-/g, '+').replace(/_/g, '/'))
                if (sub.mimeType === 'text/plain') {
                  body = decoded
                  break
                } else if (sub.mimeType === 'text/html') {
                  body = decoded
                    .replace(/<\/(div|td|tr|p|li|h[1-6])>/gi, ' ')
                    .replace(/<(br|hr)\s*\/?>/gi, ' ')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/\s+/g, ' ')
                }
              } catch (e) { /* skip */ }
            }
          }
          if (body) break
        }
      }
    }
  }

  return body
}

// ═══════════════════════════════════════════════════════
// MULTI-CURRENCY AMOUNT EXTRACTION
// ═══════════════════════════════════════════════════════

/**
 * Extract amount AND currency from text.
 * Supports all major world currencies.
 * Returns { amount: number, currency: string } or null
 */
function extractAmountAndCurrency(text) {
  if (!text) return null

  // Currency patterns ordered from most specific to least specific
  // Each: { regex, currency, group (capture group index for amount) }
  const CURRENCY_RULES = [
    // Prefixed multi-char symbols (must check before generic $)
    { regex: /CA\$\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/g, currency: 'CAD' },
    { regex: /C\$\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/g, currency: 'CAD' },
    { regex: /A\$\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/g, currency: 'AUD' },
    { regex: /AU\$\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/g, currency: 'AUD' },
    { regex: /NZ\$\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/g, currency: 'NZD' },
    { regex: /HK\$\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/g, currency: 'HKD' },
    { regex: /S\$\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/g, currency: 'SGD' },
    { regex: /NT\$\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/g, currency: 'TWD' },
    { regex: /R\$\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/g, currency: 'BRL' },
    // Unicode currency symbols
    { regex: /€\s?(\d{1,6}(?:[.,]\d{3})*(?:[.,]\d{2})?)/g, currency: 'EUR' },
    { regex: /£\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/g, currency: 'GBP' },
    { regex: /[¥￥]\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/g, currency: 'CNY' },
    { regex: /₩\s?(\d{1,6}(?:,\d{3})*)/g, currency: 'KRW' },
    { regex: /₹\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/g, currency: 'INR' },
    { regex: /₽\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/g, currency: 'RUB' },
    { regex: /₺\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/g, currency: 'TRY' },
    { regex: /₱\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/g, currency: 'PHP' },
    { regex: /฿\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/g, currency: 'THB' },
    { regex: /(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)\s?zł/g, currency: 'PLN' },
    { regex: /(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)\s?Kč/g, currency: 'CZK' },
    { regex: /(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)\s?kr/g, currency: 'SEK' },
    // Currency code before amount
    { regex: /USD\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/gi, currency: 'USD' },
    { regex: /CAD\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/gi, currency: 'CAD' },
    { regex: /EUR\s?(\d{1,6}(?:[.,]\d{3})*(?:[.,]\d{2})?)/gi, currency: 'EUR' },
    { regex: /GBP\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/gi, currency: 'GBP' },
    { regex: /CHF\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/gi, currency: 'CHF' },
    { regex: /JPY\s?(\d{1,8})/gi, currency: 'JPY' },
    { regex: /CNY\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/gi, currency: 'CNY' },
    { regex: /AUD\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/gi, currency: 'AUD' },
    { regex: /SGD\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/gi, currency: 'SGD' },
    { regex: /HKD\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/gi, currency: 'HKD' },
    { regex: /MYR\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/gi, currency: 'MYR' },
    { regex: /RM\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/g, currency: 'MYR' },
    // Currency code after amount
    { regex: /(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)\s?USD/gi, currency: 'USD' },
    { regex: /(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)\s?CAD/gi, currency: 'CAD' },
    { regex: /(\d{1,6}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s?EUR/gi, currency: 'EUR' },
    { regex: /(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)\s?GBP/gi, currency: 'GBP' },
    { regex: /(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)\s?CHF/gi, currency: 'CHF' },
    // Generic $ — defaults to USD (checked last)
    { regex: /\$\s?(\d{1,6}(?:,\d{3})*\.\d{2})/g, currency: 'USD' },
  ]

  // Strategy: find amounts near "total", "amount", "paid" keywords first
  const totalPatterns = [
    /(?:total|amount\s*(?:due|paid|charged)?|paid|charge)[:\s]*([^\n]{3,30})/gi,
    /(?:合计|支付额|总计|金额)[：:\s]*([^\n]{3,30})/g,
  ]

  // Collect all found amounts with their currencies
  const found = [] // { amount, currency, priority }

  // First pass: look near "total" / "amount" keywords (high priority)
  for (const tp of totalPatterns) {
    let tMatch
    while ((tMatch = tp.exec(text)) !== null) {
      const nearText = tMatch[1]
      for (const rule of CURRENCY_RULES) {
        const re = new RegExp(rule.regex.source, rule.regex.flags)
        let m
        while ((m = re.exec(nearText)) !== null) {
          const val = parseFloat(m[1].replace(/,/g, ''))
          if (val > 0.50 && val < 10000) {
            found.push({ amount: val, currency: rule.currency, priority: 2 })
          }
        }
      }
    }
  }

  // Second pass: find all amounts in the full text (lower priority)
  for (const rule of CURRENCY_RULES) {
    const re = new RegExp(rule.regex.source, rule.regex.flags)
    let m
    while ((m = re.exec(text)) !== null) {
      const val = parseFloat(m[1].replace(/,/g, ''))
      if (val > 0.50 && val < 10000) {
        found.push({ amount: val, currency: rule.currency, priority: 1 })
      }
    }
  }

  if (found.length === 0) return null

  // Pick the best result: highest priority, then most common amount
  found.sort((a, b) => b.priority - a.priority)

  // Among high-priority results, find the most common amount
  const highPri = found.filter(f => f.priority === found[0].priority)
  const countMap = {}
  for (const f of highPri) {
    const key = `${f.amount}_${f.currency}`
    countMap[key] = (countMap[key] || 0) + 1
  }
  const sorted = Object.entries(countMap).sort((a, b) => b[1] - a[1])
  const [amtStr, currStr] = sorted[0][0].split('_')
  return { amount: parseFloat(amtStr), currency: currStr }
}

// ═══════════════════════════════════════════════════════
// BILLING CYCLE DETECTION (4-layer)
// ═══════════════════════════════════════════════════════

/**
 * Detect billing cycle from email text.
 * Layer 1: Explicit keywords (annual, monthly, etc.)
 * Layer 2: Date range analysis (Nov 1, 2025 – Nov 1, 2026)
 * Layer 3: Return null if uncertain (let user decide)
 */
function detectBillingCycle(text) {
  if (!text) return null
  const lower = text.toLowerCase()

  // Layer 1: Explicit keywords
  // Check yearly first (more specific)
  if (/\b(annual|annually|yearly|per\s*year|\/year|\/yr|12[\s-]month|one[\s-]year)\b/i.test(lower)) return 'yearly'
  if (/\b(quarterly|per\s*quarter|\/quarter|every\s*3\s*months?|3[\s-]month)\b/i.test(lower)) return 'quarterly'
  if (/\b(monthly|per\s*month|\/month|\/mo|every\s*month)\b/i.test(lower)) return 'monthly'
  if (/\b(weekly|per\s*week|\/week)\b/i.test(lower)) return 'weekly'
  // Chinese keywords
  if (/年付|年费|年度|每年|一年/.test(text)) return 'yearly'
  if (/月付|月费|每月|包月|连续包月/.test(text)) return 'monthly'
  if (/季付|季度|每季/.test(text)) return 'quarterly'

  // Layer 2: Date range analysis
  const dateRangeCycle = detectCycleFromDateRange(text)
  if (dateRangeCycle) return dateRangeCycle

  // Layer 3: Cannot determine — return null (let user decide)
  return null
}

/**
 * Try to detect billing cycle from date ranges in the text
 * e.g., "Nov 1, 2025 – Nov 1, 2026" = yearly
 *        "Mar 9–Apr 9, 2026" = monthly
 *        "2026年3月11日~2026年4月11日" = monthly
 */
function detectCycleFromDateRange(text) {
  // English date ranges: "Start: Dec 03, 2025" + "End: Dec 03, 2026"
  const startEnd = text.match(/start[:\s]*(\w+\s+\d{1,2},?\s+\d{4})[\s\S]{0,100}?end[:\s]*(\w+\s+\d{1,2},?\s+\d{4})/i)
  if (startEnd) {
    const d1 = new Date(startEnd[1])
    const d2 = new Date(startEnd[2])
    if (!isNaN(d1) && !isNaN(d2)) {
      const days = (d2 - d1) / (1000 * 60 * 60 * 24)
      return classifyDaysToCycle(days)
    }
  }

  // Pattern: "Mon DD, YYYY – Mon DD, YYYY" or "Mon DD, YYYY - Mon DD, YYYY"
  const rangeDash = text.match(/(\w{3,9}\s+\d{1,2},?\s+\d{4})\s*[–—\-~]\s*(\w{3,9}\s+\d{1,2},?\s+\d{4})/i)
  if (rangeDash) {
    const d1 = new Date(rangeDash[1])
    const d2 = new Date(rangeDash[2])
    if (!isNaN(d1) && !isNaN(d2)) {
      const days = (d2 - d1) / (1000 * 60 * 60 * 24)
      return classifyDaysToCycle(days)
    }
  }

  // Chinese date range: "2026年3月11日~2026年4月11日" or "2026年3月11日-2026年4月11日"
  const cnRange = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日?\s*[~\-–—]\s*(\d{4})年(\d{1,2})月(\d{1,2})日?/)
  if (cnRange) {
    const d1 = new Date(cnRange[1], cnRange[2] - 1, cnRange[3])
    const d2 = new Date(cnRange[4], cnRange[5] - 1, cnRange[6])
    if (!isNaN(d1) && !isNaN(d2)) {
      const days = (d2 - d1) / (1000 * 60 * 60 * 24)
      return classifyDaysToCycle(days)
    }
  }

  // Short date range: "Mar 9–Apr 9" (same year implied)
  const shortRange = text.match(/(\w{3,9})\s+(\d{1,2})\s*[–—\-~]\s*(\w{3,9})\s+(\d{1,2})(?:,?\s+(\d{4}))?/)
  if (shortRange) {
    const year = shortRange[5] || new Date().getFullYear()
    const d1 = new Date(`${shortRange[1]} ${shortRange[2]}, ${year}`)
    const d2 = new Date(`${shortRange[3]} ${shortRange[4]}, ${year}`)
    if (!isNaN(d1) && !isNaN(d2)) {
      let days = (d2 - d1) / (1000 * 60 * 60 * 24)
      if (days < 0) days += 365 // d2 is in next year
      return classifyDaysToCycle(days)
    }
  }

  // "expires on YYYY-MM-DD" combined with date from "Paid on YYYY-MM-DD"
  const expires = text.match(/expires?\s+(?:on\s+)?(\d{4}[-/]\d{2}[-/]\d{2})/i)
  const paidOn = text.match(/paid\s+(?:on\s+)?(\w+\s+\d{1,2},?\s+\d{4}|\d{4}[-/]\d{2}[-/]\d{2})/i)
  if (expires && paidOn) {
    const d1 = new Date(paidOn[1])
    const d2 = new Date(expires[1])
    if (!isNaN(d1) && !isNaN(d2)) {
      const days = (d2 - d1) / (1000 * 60 * 60 * 24)
      return classifyDaysToCycle(days)
    }
  }

  return null
}

function classifyDaysToCycle(days) {
  if (days >= 350 && days <= 380) return 'yearly'
  if (days >= 85 && days <= 100) return 'quarterly'
  if (days >= 25 && days <= 35) return 'monthly'
  if (days >= 6 && days <= 8) return 'weekly'
  if (days >= 170 && days <= 200) return 'semi-annual'
  return null
}

/**
 * Extract next billing/renewal date from email text.
 * Looks for patterns like "Renews on Apr 9, 2026", "Next billing date: 2026-04-09"
 * Returns ISO date string or null.
 */
function extractNextBillingDate(text) {
  if (!text) return null

  const patterns = [
    // "Renews Apr 9, 2026" / "Renews on April 9, 2026"
    /(?:renews?|next\s+(?:billing|payment|charge)\s*(?:date)?)[:\s]+(?:on\s+)?(\w{3,9}\s+\d{1,2},?\s+\d{4})/i,
    // "Renews 08 Apr 2026"
    /(?:renews?|next\s+(?:billing|payment))[:\s]+(\d{1,2}\s+\w{3,9}\s+\d{4})/i,
    // "下次扣费日期: 2026-04-09" / "下次续费: 2026年4月9日"
    /(?:下次|下一次)(?:扣费|续费|付款|账单)[日期：:\s]*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)/,
    // "Next billing date: 2026-04-09"
    /next\s+(?:billing|payment)\s+date[:\s]+(\d{4}[-/]\d{1,2}[-/]\d{1,2})/i,
    // "Expires: 2026-12-03"
    /expires?\s*(?:on)?[:\s]+(\w{3,9}\s+\d{1,2},?\s+\d{4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})/i,
  ]

  for (const pat of patterns) {
    const m = text.match(pat)
    if (m) {
      try {
        // Handle Chinese date format
        let dateStr = m[1].replace(/年/, '-').replace(/月/, '-').replace(/日/, '')
        const d = new Date(dateStr)
        if (!isNaN(d) && d > new Date()) {
          return d.toISOString().split('T')[0]
        }
      } catch (e) { /* continue to next pattern */ }
    }
  }

  return null
}

/**
 * Estimate next billing date based on last email date + billing cycle.
 * Returns ISO date string or null.
 */
function estimateNextBillingDate(lastEmailDate, billingCycle) {
  if (!lastEmailDate || !billingCycle) return null

  const d = new Date(lastEmailDate)
  if (isNaN(d)) return null

  switch (billingCycle) {
    case 'monthly': d.setMonth(d.getMonth() + 1); break
    case 'quarterly': d.setMonth(d.getMonth() + 3); break
    case 'yearly': d.setFullYear(d.getFullYear() + 1); break
    case 'semi-annual': d.setMonth(d.getMonth() + 6); break
    case 'weekly': d.setDate(d.getDate() + 7); break
    default: return null
  }

  // Only return future dates
  if (d > new Date()) {
    return d.toISOString().split('T')[0]
  }

  // If estimated date is in the past, keep adding cycles until it's future
  const now = new Date()
  let attempts = 0
  while (d <= now && attempts < 100) {
    switch (billingCycle) {
      case 'monthly': d.setMonth(d.getMonth() + 1); break
      case 'quarterly': d.setMonth(d.getMonth() + 3); break
      case 'yearly': d.setFullYear(d.getFullYear() + 1); break
      case 'semi-annual': d.setMonth(d.getMonth() + 6); break
      case 'weekly': d.setDate(d.getDate() + 7); break
    }
    attempts++
  }

  return d > now ? d.toISOString().split('T')[0] : null
}

function hasBillingEvidence(subject) {
  const subLower = subject.toLowerCase()
  for (const kw of BILLING_KEYWORDS) {
    if (subLower.includes(kw)) return true
  }
  return false
}

function hasOneTimeIndicators(subject) {
  const subLower = subject.toLowerCase()
  let score = 0
  for (const kw of ONE_TIME_KEYWORDS) {
    if (subLower.includes(kw)) score++
  }
  return score >= 2
}

function extractServiceName(from) {
  const nameMatch = from.match(/^"?([^"<]+)"?\s*</)
  if (nameMatch) {
    const name = nameMatch[1].trim()
    const skip = ['noreply', 'billing', 'no-reply', 'receipt', 'support', 'payments', 'info', 'team', 'hello', 'notifications', 'mailer', 'do-not-reply', 'alert', 'invoice', 'stripe']
    if (!skip.some(s => name.toLowerCase().includes(s))) {
      return name
    }
  }
  const domainMatch = from.match(/@([^.>]+)/)
  if (domainMatch) {
    const domain = domainMatch[1]
    const skip = ['gmail', 'yahoo', 'outlook', 'hotmail', 'mail', 'email', 'send', 'bounce', 'stripe']
    if (!skip.includes(domain.toLowerCase())) {
      return domain.charAt(0).toUpperCase() + domain.slice(1)
    }
  }
  return null
}

function getLogoUrl(logoDomain) {
  if (!logoDomain) return null
  return `https://www.google.com/s2/favicons?domain=${logoDomain}&sz=64`
}

// ═══════════════════════════════════════════════════════
// APPLE APP STORE PARSING
// ═══════════════════════════════════════════════════════

/**
 * Extract individual app subscriptions from Apple receipt/renewal emails.
 * Handles multiple Apple email formats:
 *   1. "Subscription Renewal" emails with app icon + name + price + renewal date
 *   2. "Receipt" emails with App Store line items
 *   3. Generic Apple billing with price + Renews pattern
 * Returns array of { appName, amount, currency, cycle, renewDate }
 */
function extractAppleAppDetails(bodyText) {
  if (!bodyText) return []

  const apps = []
  const currencyMap = { '¥': 'CNY', '￥': 'CNY', '$': 'USD', '€': 'EUR', '£': 'GBP', '₹': 'INR', '₩': 'KRW' }

  // ── Pattern 0: "Subscription Renewal" format ──
  // Apple sends emails like:
  //   "全民K歌-唱歌录歌首选 ... 1个月全民K歌会员 (1 month) ¥19.00/month"
  //   "Starting from 23 March 2026, your subscription automatically renews for ¥19.00/month"
  // Or receipt format:
  //   "WPS Office  WPS会员连续月订阅 (Monthly)  ¥9.00  Renews 19 Apr 2026"

  // Pattern 0a: "automatically renews for PRICE/period" — extract price & cycle
  const autoRenewPattern = /(?:automatically\s+renews?\s+for\s+)([¥￥$€£₹₩])\s*(\d{1,6}(?:[.,]\d{2})?)\/(\w+)/gi
  let autoMatch
  while ((autoMatch = autoRenewPattern.exec(bodyText)) !== null) {
    const symbol = autoMatch[1]
    const amount = parseFloat(autoMatch[2].replace(/,/g, ''))
    const currency = currencyMap[symbol] || 'USD'
    const periodStr = autoMatch[3].toLowerCase()
    let cycle = null
    if (periodStr.includes('month')) cycle = 'monthly'
    else if (periodStr.includes('year')) cycle = 'yearly'
    else if (periodStr.includes('week')) cycle = 'weekly'

    // Look backwards 500 chars for app name (Apple puts it before the price)
    const beforeText = bodyText.slice(Math.max(0, autoMatch.index - 500), autoMatch.index)

    // Try to find app name — typically a Chinese/English name before plan description
    // Look for the first substantial text block that isn't boilerplate
    let appName = null

    // Pattern: "AppName  SubDescription (period)" — find the name chunk
    const namePatterns = [
      // Chinese app name at start of a section: "全民K歌-唱歌录歌首选"
      /([\u4e00-\u9fff][\u4e00-\u9fffA-Za-z0-9\-·.]{1,40})/g,
      // English app name
      /([A-Z][A-Za-z0-9\s.]{2,30}?)(?:\s{2,}|\n)/g,
    ]

    for (const np of namePatterns) {
      const allMatches = [...beforeText.matchAll(np)]
      if (allMatches.length > 0) {
        // Take the last substantial match (closest to the price)
        for (let mi = allMatches.length - 1; mi >= 0; mi--) {
          const candidate = allMatches[mi][1].trim()
            .replace(/\s*(?:超级|连续|包月|包年|订阅|会员|自动续费)\s*.*$/i, '')
            .replace(/\s*\d+个月.*$/i, '')
            .trim()
          // Skip boilerplate
          const skipWords = ['dear', 'sincerely', 'apple', 'subscription renewal', 'receipt', 'hello', 'total', 'billed to']
          if (candidate.length >= 2 && candidate.length <= 60 && !skipWords.some(s => candidate.toLowerCase().includes(s))) {
            appName = candidate
            break
          }
        }
        if (appName) break
      }
    }

    // Extract renewal start date: "Starting from 23 March 2026"
    let renewDate = null
    const startMatch = bodyText.slice(autoMatch.index, autoMatch.index + 200).match(/starting\s+from\s+(\d{1,2}\s+\w{3,9}\s+\d{4})/i)
      || beforeText.match(/starting\s+from\s+(\d{1,2}\s+\w{3,9}\s+\d{4})/i)
    if (startMatch) {
      try { renewDate = new Date(startMatch[1]).toISOString() } catch (e) { /* ignore */ }
    }

    if (appName && !apps.some(a => a.appName === appName)) {
      apps.push({ appName, amount, currency, cycle, renewDate })
    }
  }

  // ── Pattern 1: Price + "Renews" nearby (most reliable indicator of subscription) ──
  const pricePattern = /([¥￥$€£₹₩])\s*(\d{1,6}(?:[.,]\d{2})?)/g
  let priceMatch
  while ((priceMatch = pricePattern.exec(bodyText)) !== null) {
    const afterPrice = bodyText.slice(priceMatch.index, priceMatch.index + 200)
    const renewMatch = afterPrice.match(/Renews?\s+(\d{1,2}\s+\w{3,9}\s+\d{4})/i)
    if (!renewMatch) continue

    // Look backwards from price to find the app name
    const beforePrice = bodyText.slice(Math.max(0, priceMatch.index - 300), priceMatch.index)
    // Get the last meaningful text chunk before the price
    const nameChunks = beforePrice.split(/\s{3,}|\n|App Store/i).filter(s => s.trim().length > 1)
    if (nameChunks.length === 0) continue

    let rawName = nameChunks[nameChunks.length - 1].trim()

    // Clean up: remove plan description suffixes
    rawName = rawName
      .replace(/\s*(?:超级|连续|包月|包年|订阅|会员|自动续费|Premium|Pro|Plus|Monthly|Yearly|Annual)\s*.*$/i, '')
      .replace(/\s*\((?:Monthly|Yearly|Annual|Weekly)\)\s*$/i, '')
      .replace(/\s*\d+个月.*$/i, '')
      .trim()

    if (!rawName || rawName.length < 2 || rawName.length > 80) continue

    // Skip if it's a generic word
    const lower = rawName.toLowerCase()
    if (['total', 'subtotal', 'amount', 'tax', 'price', 'billed to', 'report a problem'].includes(lower)) continue

    const symbol = priceMatch[1]
    const amount = parseFloat(priceMatch[2].replace(/,/g, ''))
    const currency = currencyMap[symbol] || 'USD'

    // Detect cycle from surrounding text
    const contextText = bodyText.slice(Math.max(0, priceMatch.index - 100), priceMatch.index + 300)
    let cycle = null
    if (/monthly|包月|连续包月|每月|\/month|1\s*month/i.test(contextText)) cycle = 'monthly'
    else if (/yearly|annual|包年|每年|年度|\/year|1\s*year/i.test(contextText)) cycle = 'yearly'
    else if (/weekly|每周|\/week/i.test(contextText)) cycle = 'weekly'

    // Extract renewal date
    let renewDate = null
    try {
      renewDate = new Date(renewMatch[1]).toISOString()
    } catch (e) { /* ignore */ }

    // Deduplicate by app name
    if (!apps.some(a => a.appName === rawName)) {
      apps.push({ appName: rawName, amount, currency, cycle, renewDate })
    }
  }

  // ── Pattern 2: Fallback — scan for "Renews DD Mon YYYY" and work backwards ──
  if (apps.length === 0) {
    const renewFallback = /Renews?\s+(\d{1,2}\s+\w{3,9}\s+\d{4})/gi
    let rm
    while ((rm = renewFallback.exec(bodyText)) !== null) {
      // Look for a price before "Renews"
      const before = bodyText.slice(Math.max(0, rm.index - 300), rm.index)
      const lastPrice = [...before.matchAll(/([¥￥$€£₹₩])\s*(\d{1,6}(?:\.\d{2})?)/g)].pop()
      if (!lastPrice) continue

      const symbol = lastPrice[1]
      const amount = parseFloat(lastPrice[2])
      const currency = currencyMap[symbol] || 'USD'

      // Get name from before the price
      const beforePriceText = before.slice(0, lastPrice.index)
      const chunks = beforePriceText.split(/\s{3,}|\n|App Store/i).filter(s => s.trim().length > 1)
      if (chunks.length === 0) continue

      let appName = chunks[chunks.length - 1].trim()
        .replace(/\s*(?:超级|连续|包月|包年|订阅|会员|Premium|Pro|Plus)\s*.*$/i, '')
        .replace(/\s*\d+个月.*$/i, '')
        .trim()

      if (appName.length >= 2 && appName.length <= 80 && !apps.some(a => a.appName === appName)) {
        apps.push({ appName, amount, currency, cycle: 'monthly', renewDate: null })
      }
    }
  }

  // ── Pattern 3: Chinese Apple receipts — "AppName  description  ¥XX.XX" table rows ──
  // Apple often sends a table: "全民K歌-唱歌录歌首选  1个月全民K歌会员  ¥19.00"
  if (apps.length === 0) {
    // Look for Chinese app name followed by price in a table-like layout
    const chineseAppPattern = /([\u4e00-\u9fff][\u4e00-\u9fffA-Za-z0-9\-·.]{1,30}?)[\s\S]{0,100}?([¥￥$€£₹₩])\s*(\d{1,6}(?:\.\d{2})?)/g
    let cm
    while ((cm = chineseAppPattern.exec(bodyText)) !== null) {
      let appName = cm[1].trim()
        .replace(/[-\s]*(?:唱歌|录歌|首选|工具|助手|日记|记账|小说|漫画|视频|音乐|游戏|社区|平台|商城|市场).*$/i, '')
        .trim()
      // Skip boilerplate
      const skipChinese = ['订阅', '续期', '收据', '账单', '苹果', '发票', '报告', '此致']
      if (appName.length < 2 || skipChinese.some(s => appName === s)) continue

      const symbol = cm[2]
      const amount = parseFloat(cm[3])
      const currency = currencyMap[symbol] || 'CNY'

      // Check surrounding context for cycle info
      const context = bodyText.slice(Math.max(0, cm.index - 50), cm.index + 200)
      let cycle = null
      if (/monthly|包月|连续包月|每月|\/month|1\s*month|1个月/i.test(context)) cycle = 'monthly'
      else if (/yearly|annual|包年|每年|年度|\/year|1\s*year/i.test(context)) cycle = 'yearly'

      if (!apps.some(a => a.appName === appName)) {
        apps.push({ appName, amount, currency, cycle, renewDate: null })
      }
    }
  }

  return apps
}

// ═══════════════════════════════════════════════════════
// PDF ATTACHMENT PARSING
// ═══════════════════════════════════════════════════════

/**
 * Find PDF attachments in a Gmail message
 * Returns [{ attachmentId, filename }]
 */
function findPdfAttachments(message) {
  const pdfs = []
  const parts = message.payload?.parts || []

  function scanParts(partList) {
    for (const part of partList) {
      if (part.filename && part.filename.toLowerCase().endsWith('.pdf') && part.body?.attachmentId) {
        pdfs.push({ attachmentId: part.body.attachmentId, filename: part.filename })
      }
      if (part.parts) scanParts(part.parts)
    }
  }

  scanParts(parts)
  return pdfs
}

/**
 * Extract text from a PDF attachment using pdf.js (lazy loaded)
 */
async function extractPdfText(base64Data) {
  try {
    // Dynamic import to keep initial bundle small
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

    // Convert base64url to Uint8Array
    const binary = atob(base64Data.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }

    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
    let fullText = ''

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items.map(item => item.str).join(' ')
      fullText += pageText + '\n'
    }

    return fullText
  } catch (err) {
    console.warn('PDF parsing failed:', err)
    return ''
  }
}

// ═══════════════════════════════════════════════════════
// STRIPE / INTERMEDIARY LINE ITEM EXTRACTION
// ═══════════════════════════════════════════════════════

/**
 * Extract line item / product name from a Stripe receipt body.
 * Returns a string (product name) or null.
 *
 * Stripe receipts have various formats:
 *   "html.to.design — by ‹div›RIOTS  $120.96"
 *   "Personal Editors  CA$40.00"
 *   "Max plan - 20x  CA$280.00"
 *   "Description ... Amount ... Product Name ... $XX.XX"
 */
function extractStripeLineItem(bodyText) {
  if (!bodyText) return null

  // Currency symbol pattern (reusable)
  const currSym = '(?:CA\\$|A\\$|NZ\\$|HK\\$|S\\$|NT\\$|R\\$|US\\$|€|£|¥|￥|₹|₩|\\$)'

  // Strategy: find lines where a product name precedes a price.
  // We try multiple patterns from most specific to least specific.
  const patterns = [
    // Pattern 1: "Name — by Company  $XX.XX" (Stripe plugin/marketplace format)
    new RegExp(`([\\w][\\w\\s.\\-—–]{2,60}?)\\s+${currSym}\\s?\\d{1,6}(?:[.,]\\d{2})?`, 'gm'),
    // Pattern 2: Near "description" or "summary" header
    new RegExp(`(?:description|summary|item|product)[:\\s]*([^\\n]{3,80}?)\\s+${currSym}`, 'gi'),
  ]

  // Collect candidate names
  const candidates = []
  const skipWords = ['total', 'amount', 'subtotal', 'tax', 'vat', 'discount', 'credit',
    'paid', 'payment', 'receipt', 'invoice', 'date', 'card', 'visa', 'mastercard',
    'billing', 'period', 'from', 'thanks', 'thank you', 'questions', 'contact',
    'refund', 'coupon', 'promo', 'balance', 'view', 'download', 'manage']

  for (const pat of patterns) {
    let m
    while ((m = pat.exec(bodyText)) !== null) {
      let name = m[1].trim()
        .replace(/\s+/g, ' ')
        .replace(/^[-–—·•\s]+/, '')
        .replace(/[-–—·•\s]+$/, '')

      if (name.length < 3 || name.length > 70) continue

      // Skip generic/boilerplate words
      const lower = name.toLowerCase()
      if (skipWords.some(w => lower === w || (lower.startsWith(w) && lower.length < w.length + 3))) continue
      // Skip if it's just a number or date
      if (/^\d+$/.test(name) || /^\w{3}\s+\d{1,2},?\s+\d{4}$/.test(name)) continue

      candidates.push(name)
    }
  }

  // Return the first non-trivial candidate (Stripe receipts put the product name early)
  if (candidates.length > 0) {
    return candidates[0]
  }

  return null
}

// ═══════════════════════════════════════════════════════
// FREQUENCY ANALYSIS (core of V3/V4)
// ═══════════════════════════════════════════════════════

/**
 * Analyze a group of emails from the same sender domain.
 * Enhanced V6: Better handling of yearly subscriptions and mixed intervals.
 * Returns { isRecurring, confidence, cycle, intervalDays }
 */
function analyzeFrequency(emailDates) {
  if (emailDates.length < 2) {
    // Single email — can't determine frequency from dates alone.
    // Phase 4 will try to detect cycle from email body keywords.
    return { isRecurring: false, confidence: 'none', cycle: null, intervalDays: null }
  }

  // Sort dates newest first
  const sorted = [...emailDates].sort((a, b) => b - a)

  // Calculate intervals between consecutive emails (in days)
  const intervals = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const diffMs = sorted[i] - sorted[i + 1]
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    intervals.push(diffDays)
  }

  // Average interval
  const avgInterval = intervals.reduce((sum, d) => sum + d, 0) / intervals.length

  // Median interval (more robust against outliers)
  const sortedIntervals = [...intervals].sort((a, b) => a - b)
  const medianInterval = sortedIntervals[Math.floor(sortedIntervals.length / 2)]

  // ── Check for monthly pattern (20-40 day intervals) ──
  const monthlyIntervals = intervals.filter(d => d >= 20 && d <= 40)
  if (monthlyIntervals.length >= intervals.length * 0.6) {
    const confidence = emailDates.length >= 3 ? 'high' : 'medium'
    return { isRecurring: true, confidence, cycle: 'monthly', intervalDays: medianInterval }
  }

  // ── Check for quarterly pattern (75-105 day intervals) ──
  const quarterlyIntervals = intervals.filter(d => d >= 75 && d <= 105)
  if (quarterlyIntervals.length >= intervals.length * 0.5) {
    const confidence = emailDates.length >= 3 ? 'high' : 'medium'
    return { isRecurring: true, confidence, cycle: 'quarterly', intervalDays: medianInterval }
  }

  // ── Check for yearly pattern (330-400 day intervals) ──
  const yearlyIntervals = intervals.filter(d => d >= 330 && d <= 400)
  if (yearlyIntervals.length >= 1) {
    // With 3 years of data, 2+ yearly intervals = high confidence
    const confidence = yearlyIntervals.length >= 2 ? 'high' : 'medium'
    return { isRecurring: true, confidence, cycle: 'yearly', intervalDays: medianInterval }
  }

  // ── Check for semi-annual pattern (170-200 day intervals) ──
  const semiAnnualIntervals = intervals.filter(d => d >= 170 && d <= 200)
  if (semiAnnualIntervals.length >= 1) {
    return { isRecurring: true, confidence: 'medium', cycle: 'semi-annual', intervalDays: medianInterval }
  }

  // ── Fallback: use median interval to classify ──
  // This handles cases where intervals are somewhat noisy but cluster around a cycle
  if (emailDates.length >= 3) {
    if (medianInterval >= 25 && medianInterval <= 35) {
      return { isRecurring: true, confidence: 'medium', cycle: 'monthly', intervalDays: medianInterval }
    }
    if (medianInterval >= 85 && medianInterval <= 100) {
      return { isRecurring: true, confidence: 'medium', cycle: 'quarterly', intervalDays: medianInterval }
    }
    if (medianInterval >= 340 && medianInterval <= 395) {
      return { isRecurring: true, confidence: 'medium', cycle: 'yearly', intervalDays: medianInterval }
    }
  }

  // Not a clear pattern — could be irregular billing notifications
  return { isRecurring: false, confidence: 'none', cycle: null, intervalDays: avgInterval }
}

// ═══════════════════════════════════════════════════════
// MAIN SCAN FUNCTION
// ═══════════════════════════════════════════════════════

/**
 * Scan Gmail for recurring subscriptions using frequency analysis
 *
 * @param {string} token - Google OAuth access token
 * @param {function} onProgress - callback({ phase, message, current, total })
 * @param {object} options - { months: 6 } scan time range
 * @returns {{ confirmed: Array, needsReview: Array }}
 */
export async function scanGmailForSubscriptions(token, onProgress, options = {}) {
  if (!token) throw new Error('No Google token available. Please sign out and sign in again.')

  const months = options.months || 36

  // ════════════════════════════════════════════════
  // PHASE 1: Search for billing/receipt emails
  // ════════════════════════════════════════════════
  if (onProgress) onProgress({ phase: 1, message: 'Searching billing emails...', current: 0, total: 0 })

  const query = [
    '(subject:(receipt OR invoice OR "payment confirmation" OR "billing statement"',
    'OR "your bill" OR "payment received" OR "successfully charged"',
    'OR "subscription renewed" OR "renewal" OR "auto-renew"',
    'OR "amount charged" OR "transaction" OR "monthly charge"',
    'OR "your receipt" OR "recurring payment" OR "billing period"',
    'OR membership OR "tax invoice" OR "subscription confirmation"',
    'OR "your subscription" OR "plan renewal" OR "welcome to your"',
    'OR "paid subscription" OR "order receipt" OR "your plan"',
    'OR "subscription renewal" OR "renew" OR "auto-renewal"',
    'OR 收据 OR 发票 OR 账单 OR 订阅 OR 会员))',
    `newer_than:${months}m`,
    '-category:promotions',
    '-category:social',
  ].join(' ')

  const messages = await searchAllMessages(token, query, 2000)

  if (messages.length === 0) {
    return { confirmed: [], needsReview: [] }
  }

  if (onProgress) onProgress({ phase: 1, message: `Found ${messages.length} billing emails`, current: messages.length, total: messages.length })

  // ════════════════════════════════════════════════
  // PHASE 2: Get metadata & group by sender domain
  //           (with intermediary domain resolution)
  // ════════════════════════════════════════════════
  if (onProgress) onProgress({ phase: 2, message: 'Analyzing senders...', current: 0, total: messages.length })

  // Group: { "spotify.com": [{ id, from, subject, date, resolvedDomain?, resolvedName? }, ...] }
  const senderGroups = {}
  const batchSize = 10

  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize)
    const results = await Promise.all(
      batch.map(m => getMessageMetadata(token, m.id))
    )

    for (const msg of results) {
      if (!msg) continue
      const from = getHeader(msg, 'From')
      const subject = getHeader(msg, 'Subject')
      const dateStr = getHeader(msg, 'Date')
      let domain = extractRootDomain(from)

      if (!domain) continue

      // Skip blocklisted senders
      if (isBlocklisted(domain, from, subject)) continue

      // Skip one-time purchase emails
      if (hasOneTimeIndicators(subject)) continue

      // Handle intermediary domains (Stripe, etc.)
      let resolvedName = null
      let resolvedDomain = null
      if (isIntermediaryDomain(domain)) {
        resolvedName = extractIntermediaryServiceInfo(subject, null)
        if (resolvedName) {
          // Try to find the real domain from our known list
          const knownMatch = findKnownServiceByName(resolvedName)
          if (knownMatch) {
            resolvedDomain = knownMatch.matchedDomain
            domain = resolvedDomain // group under real service domain
          } else {
            // Unknown service via Stripe — use sanitized name as key
            domain = `stripe:${resolvedName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
          }
        } else {
          // Can't determine who the Stripe receipt is for — skip
          continue
        }
      }

      // Handle platform domains (Substack, Patreon, etc.)
      // Group by specific sender within the platform, not just the platform domain.
      // e.g., lenny@substack.com and another@substack.com become separate groups.
      if (PLATFORM_DOMAINS[domain]) {
        // Extract the specific email sender (before @) to create sub-groups
        const emailMatch = from.match(/<([^@]+)@/)
        if (emailMatch) {
          const senderUser = emailMatch[1].toLowerCase()
          // Use "platform:sender" as the group key
          domain = `${domain}:${senderUser}`
        }
      }

      if (!senderGroups[domain]) senderGroups[domain] = []
      senderGroups[domain].push({
        id: msg.id,
        from,
        subject,
        date: new Date(dateStr),
        resolvedName,
        resolvedDomain,
      })
    }

    if (onProgress) onProgress({
      phase: 2,
      message: `Analyzed ${Math.min(i + batchSize, messages.length)} of ${messages.length} emails`,
      current: Math.min(i + batchSize, messages.length),
      total: messages.length,
    })
  }

  const domainCount = Object.keys(senderGroups).length
  if (onProgress) onProgress({ phase: 2, message: `Found ${domainCount} unique senders`, current: domainCount, total: domainCount })

  // ════════════════════════════════════════════════
  // PHASE 3: Frequency analysis
  // ════════════════════════════════════════════════
  if (onProgress) onProgress({ phase: 3, message: 'Detecting subscription patterns...', current: 0, total: domainCount })

  const passedDomains = []

  let analyzed = 0
  for (const [domain, emails] of Object.entries(senderGroups)) {
    analyzed++

    // Extract the base domain for matching (strip platform:sender and stripe: prefixes)
    const baseDomain = domain.includes(':') ? domain.split(':')[0] : domain
    const isKnown = domain.startsWith('stripe:')
      ? findKnownServiceByName(emails[0]?.resolvedName) !== null
      : (PLATFORM_DOMAINS[baseDomain] != null) || matchKnownService(baseDomain, emails[0]?.subject || '') !== null
    const dates = emails.map(e => e.date)
    const freq = analyzeFrequency(dates)

    if (freq.isRecurring) {
      passedDomains.push({ domain, emails, frequency: freq, isKnown })
    } else if (isKnown && emails.length >= 1) {
      // Known services with even 1 billing email should pass —
      // yearly subscriptions may only have 1 email in a 3-year window.
      const hasBilling = emails.some(e => hasBillingEvidence(e.subject))
      if (hasBilling || isKnown) {
        passedDomains.push({
          domain,
          emails,
          frequency: { isRecurring: false, confidence: 'low', cycle: null, intervalDays: null },
          isKnown,
        })
      }
    } else if (!isKnown && emails.length >= 1) {
      // UNKNOWN brands: only pass if emails have STRONG subscription signals.
      // Generic "receipt"/"invoice" are NOT enough — shopping receipts have those too.
      // Must contain explicit subscription/recurring keywords to avoid false positives.
      const hasStrong = emails.some(e => hasStrongSubscriptionEvidence(e.subject))
      if (hasStrong) {
        passedDomains.push({
          domain,
          emails,
          frequency: freq.isRecurring ? freq : { isRecurring: false, confidence: 'low', cycle: freq.cycle, intervalDays: freq.intervalDays },
          isKnown: false,
          _unknownWithBilling: true, // flag for Phase 4 to put in needsReview
        })
      }
    }

    if (onProgress) onProgress({
      phase: 3,
      message: `Analyzed ${analyzed} of ${domainCount} senders — ${passedDomains.length} subscriptions detected`,
      current: analyzed,
      total: domainCount,
    })
  }

  if (passedDomains.length === 0) {
    return { confirmed: [], needsReview: [] }
  }

  // ════════════════════════════════════════════════
  // PHASE 4: Extract details from full email body + PDF
  // ════════════════════════════════════════════════
  if (onProgress) onProgress({ phase: 4, message: 'Extracting prices...', current: 0, total: passedDomains.length })

  const confirmed = []
  const needsReview = []

  for (let i = 0; i < passedDomains.length; i++) {
    const { domain, emails, frequency, isKnown, _unknownWithBilling } = passedDomains[i]

    // Get the most recent email's full content for price extraction
    const newestEmail = emails.sort((a, b) => b.date - a.date)[0]
    const fullMsg = await getFullMessage(token, newestEmail.id)

    let priceResult = null // { amount, currency }
    let bodyText = ''
    let cycle = null
    let nextDate = null
    const lastEmailDate = newestEmail.date.toISOString()

    if (fullMsg) {
      bodyText = decodeBody(fullMsg.payload)
      const fullText = `${newestEmail.subject} ${bodyText}`

      // Extract price
      priceResult = extractAmountAndCurrency(fullText)

      // If no price found in body, try PDF attachment
      if (!priceResult) {
        const pdfs = findPdfAttachments(fullMsg)
        for (const pdf of pdfs) {
          try {
            const attachData = await getAttachment(token, newestEmail.id, pdf.attachmentId)
            if (attachData) {
              const pdfText = await extractPdfText(attachData)
              if (pdfText) {
                priceResult = extractAmountAndCurrency(pdfText)
                // Also use PDF text for cycle detection
                if (priceResult) {
                  bodyText = bodyText + ' ' + pdfText
                  break
                }
              }
            }
          } catch (err) {
            console.warn('PDF extraction failed for', pdf.filename, err)
          }
        }
      }

      // If still no price, try second-newest email
      if (!priceResult && emails.length >= 2) {
        const secondEmail = emails.sort((a, b) => b.date - a.date)[1]
        const secondMsg = await getFullMessage(token, secondEmail.id)
        if (secondMsg) {
          const secondBody = decodeBody(secondMsg.payload)
          priceResult = extractAmountAndCurrency(`${secondEmail.subject} ${secondBody}`)

          // Try PDF in second email too
          if (!priceResult) {
            const pdfs2 = findPdfAttachments(secondMsg)
            for (const pdf of pdfs2) {
              try {
                const attachData = await getAttachment(token, secondEmail.id, pdf.attachmentId)
                if (attachData) {
                  const pdfText = await extractPdfText(attachData)
                  if (pdfText) {
                    priceResult = extractAmountAndCurrency(pdfText)
                    if (priceResult) {
                      bodyText = bodyText + ' ' + pdfText
                      break
                    }
                  }
                }
              } catch (err) { /* skip */ }
            }
          }
        }
      }

      // Detect billing cycle — prioritize: frequency analysis > email body keywords > date range
      const combinedText = `${newestEmail.subject} ${bodyText}`
      const bodyDetectedCycle = detectBillingCycle(combinedText)
      // Prefer frequency analysis cycle (based on actual email intervals) over body keywords
      cycle = frequency.cycle || bodyDetectedCycle
      // cycle may still be null — that's OK, user will choose

      // Extract next billing date from email content first
      nextDate = extractNextBillingDate(combinedText)
    }

    // ── Handle Apple App Store receipts: extract individual apps ──
    const isApple = domain === 'apple.com' || domain.endsWith('.apple.com')
    if (isApple && bodyText) {
      const appDetails = extractAppleAppDetails(bodyText)
      if (appDetails.length > 0) {
        // Create a subscription item for each app
        for (const app of appDetails) {
          const appSub = {
            name: `${app.appName} (App Store)`,
            category: 'entertainment',
            amount: app.amount || null,
            currency: app.currency || 'USD',
            billing_cycle: app.cycle || cycle || null,
            status: 'active',
            next_billing_date: app.renewDate || null,
            last_email_date: newestEmail.date.toISOString(),
            logo_url: getLogoUrl('apple.com'),
            notes: 'Found via inbox scan (App Store)',
            _emailCount: emails.length,
            _confidence: frequency.confidence,
            _domain: 'apple.com',
          }
          needsReview.push(appSub) // App Store items always go to review
        }
        // Skip the normal flow for this Apple domain
        if (onProgress) onProgress({
          phase: 4,
          message: `Extracted ${appDetails.length} App Store subscriptions (${i + 1}/${passedDomains.length})`,
          current: i + 1,
          total: passedDomains.length,
        })
        continue
      }
    }

    // ── Determine service name, category, logo ──
    let knownInfo = null
    let serviceName = null

    // Get base domain (strip platform:sender prefix like "substack.com:lenny")
    const lookupDomain = domain.includes(':') && !domain.startsWith('stripe:')
      ? domain.split(':')[0]
      : domain

    if (domain.startsWith('stripe:')) {
      // Intermediary-resolved service
      const resolvedName = newestEmail.resolvedName
      knownInfo = findKnownServiceByName(resolvedName)
      // Try to extract more specific product name from body (e.g., Figma plugin)
      const lineItem = extractStripeLineItem(bodyText)
      if (lineItem && lineItem.length > 2 && (!knownInfo || !lineItem.toLowerCase().includes(knownInfo.name.toLowerCase()))) {
        // Show as "html.to.design (via Figma)" if we know the parent service
        const parentName = knownInfo?.name || resolvedName
        serviceName = parentName ? `${lineItem} (via ${parentName})` : lineItem
      } else {
        serviceName = knownInfo?.name || resolvedName || domain.replace('stripe:', '')
      }
    } else if (PLATFORM_DOMAINS[lookupDomain]) {
      // Platform domain — extract specific creator/product name
      const platformInfo = PLATFORM_DOMAINS[lookupDomain]
      knownInfo = matchKnownService(lookupDomain, newestEmail.subject) || {
        name: platformInfo.platform,
        category: platformInfo.category,
        logo: platformInfo.logo,
      }
      const subName = extractPlatformSubName(lookupDomain, newestEmail.from, newestEmail.subject, bodyText)
      if (subName) {
        serviceName = `${subName} (via ${platformInfo.platform})`
      } else {
        serviceName = platformInfo.platform
      }
    } else {
      knownInfo = matchKnownService(lookupDomain, newestEmail.subject)
      serviceName = knownInfo?.name || extractServiceName(newestEmail.from) || lookupDomain
    }

    const category = knownInfo?.category || 'other'
    const logoDomain = knownInfo?.logo || (domain.startsWith('stripe:') ? (knownInfo?.matchedDomain || domain.replace('stripe:', '')) : lookupDomain)

    // Estimate next billing date if not extracted from email
    if (!nextDate && cycle) {
      nextDate = estimateNextBillingDate(lastEmailDate, cycle)
    }

    // ── Detect "upcoming/pending" subscriptions ──
    // Emails that say "subscription starts on [date]" or "paid subscription start date"
    // but have no actual charge yet
    let isPending = false
    if (bodyText) {
      const pendingPatterns = [
        /paid\s+subscription\s+start\s*(?:date)?[:\s]+/i,
        /subscription\s+(?:starts?|begins?)\s+(?:on\s+)?/i,
        /your\s+(?:new\s+)?plan\s+(?:starts?|begins?)\s+/i,
      ]
      if (pendingPatterns.some(p => p.test(bodyText)) && !priceResult) {
        isPending = true
      }
    }

    // ── Single-email flag for user confirmation ──
    const isSingleEmail = emails.length === 1
    let noteText = 'Found via inbox scan'
    if (isSingleEmail && !frequency.isRecurring) {
      noteText = 'Found via inbox scan (single email — please confirm if still active)'
    }
    if (isPending) {
      noteText = 'Upcoming subscription detected (no charge yet — please confirm and enter amount)'
    }

    const subscription = {
      name: serviceName,
      category,
      amount: priceResult?.amount || null,
      currency: priceResult?.currency || 'USD',
      billing_cycle: cycle, // null = unknown, user will choose
      status: isPending ? 'pending' : 'active',
      next_billing_date: nextDate,
      last_email_date: lastEmailDate,
      logo_url: getLogoUrl(logoDomain),
      notes: noteText,
      _emailCount: emails.length,
      _confidence: frequency.confidence,
      _domain: lookupDomain.startsWith('stripe:') ? lookupDomain.replace('stripe:', '') : lookupDomain,
      _singleEmail: isSingleEmail && !frequency.isRecurring,
      _isPending: isPending,
    }

    if (isKnown && frequency.confidence !== 'low' && !_unknownWithBilling) {
      confirmed.push(subscription)
    } else {
      // Low confidence, unknown brands with billing evidence, single-email, or pending
      // all go to needsReview for user confirmation
      needsReview.push(subscription)
    }

    if (onProgress) onProgress({
      phase: 4,
      message: `Extracted details for ${serviceName} (${i + 1}/${passedDomains.length})`,
      current: i + 1,
      total: passedDomains.length,
    })
  }

  return { confirmed, needsReview }
}

/**
 * Quick check if we have a valid Gmail token
 */
export async function testGmailAccess(token) {
  try {
    const url = `${GMAIL_API}/profile`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.ok
  } catch {
    return false
  }
}
