/**
 * Gmail Inbox Scanner for SnipKitty (V3)
 *
 * Strategy: Frequency Analysis
 * Phase 1: Search Gmail for billing/receipt emails (metadata only)
 * Phase 2: Group by sender root domain
 * Phase 3: Frequency analysis — only recurring senders pass
 * Phase 4: Fetch full email body for passing senders, extract price & details
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
  'sketch.com':        { name: 'Sketch', category: 'design', logo: 'sketch.com' },
  'invisionapp.com':   { name: 'InVision', category: 'design', logo: 'invisionapp.com' },
  'framer.com':        { name: 'Framer', category: 'design', logo: 'framer.com' },
  'webflow.com':       { name: 'Webflow', category: 'design', logo: 'webflow.com' },
  'spline.design':     { name: 'Spline', category: 'design', logo: 'spline.design' },
  'protopie.io':       { name: 'ProtoPie', category: 'design', logo: 'protopie.io' },
  'envato.com':        { name: 'Envato Elements', category: 'design', logo: 'envato.com' },
  'creativemarket.com': { name: 'Creative Market', category: 'design', logo: 'creativemarket.com' },

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
    { keywords: ['apple music', 'music'], name: 'Apple Music', category: 'music', logo: 'music.apple.com' },
    { keywords: ['icloud', 'storage'], name: 'iCloud+', category: 'cloud-storage', logo: 'icloud.com' },
    { keywords: ['arcade'], name: 'Apple Arcade', category: 'gaming', logo: 'apple.com' },
    { keywords: ['fitness+', 'fitness'], name: 'Apple Fitness+', category: 'health', logo: 'apple.com' },
    { keywords: ['apple one'], name: 'Apple One', category: 'entertainment', logo: 'apple.com' },
  ],
  'google.com': [
    { keywords: ['google one', 'storage plan'], name: 'Google One', category: 'cloud-storage', logo: 'one.google.com' },
    { keywords: ['youtube premium', 'yt premium'], name: 'YouTube Premium', category: 'entertainment', logo: 'youtube.com' },
    { keywords: ['youtube music'], name: 'YouTube Music', category: 'music', logo: 'music.youtube.com' },
    { keywords: ['google workspace', 'workspace'], name: 'Google Workspace', category: 'productivity', logo: 'workspace.google.com' },
    { keywords: ['play pass'], name: 'Google Play Pass', category: 'gaming', logo: 'play.google.com' },
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

// ─── BLOCKLIST: Non-subscription recurring senders ───
const BLOCKLIST = [
  // Telecom / ISPs / Utilities
  'bell.ca', 'bell.net', 'rogers.com', 'telus.com', 'fido.ca', 'koodo.com',
  'virginmobile', 'virginplus', 'shaw.ca', 'att.com', 'att.net', 'verizon.com',
  'tmobile.com', 't-mobile.com', 'comcast.com', 'xfinity.com', 'spectrum.com',
  'hydroone', 'enbridge', 'fortisbc', 'bchydro',
  // Insurance
  'equitable', 'sunlife', 'manulife', 'greatwest', 'desjardins',
  'statefarm', 'allstate', 'geico', 'progressive.com',
  // Retailers
  'bestbuy', 'walmart', 'costco', 'target.com', 'ikea',
  'homedepot', 'lowes', 'staples', 'winners', 'marshalls',
  'aritzia', 'zara.com', 'hm.com', 'uniqlo', 'gap.com', 'oldnavy',
  'lululemon', 'oakandfort', 'oak+fort', 'sephora', 'ulta', 'nordstrom',
  'shein', 'fashionnova', 'ssense', 'farfetch', 'abercrombie',
  // Transportation / Car
  'uber.com', 'lyft.com', 'turo.com', 'enterprise.com', 'hertz.com',
  '407etr', '407 etr',
  // Food delivery
  'doordash', 'ubereats', 'skipthedishes', 'grubhub', 'instacart',
  // Banks / Finance
  'paypal.com', 'venmo.com', 'interac', 'scotiabank', 'tdbank', 'td.com',
  'rbc.com', 'rbcroyalbank', 'bmo.com', 'cibc.com',
  'americanexpress', 'chase.com', 'capitalone',
  // Government
  'cra-arc', 'canada.ca', 'irs.gov',
  // Shipping
  'fedex.com', 'ups.com', 'usps.com', 'canadapost', 'dhl.com', 'purolator',
  // Travel
  'airbnb.com', 'booking.com', 'expedia.com', 'hotels.com',
  // Physical services (not SaaS)
  'accessstorage', 'storagemart', 'publicstore',
  // Real estate
  'zillow', 'realtor.com', 'redfin',
]

// ─── BILLING / RECEIPT KEYWORDS (email must have at least one) ───
const BILLING_KEYWORDS = [
  'receipt', 'invoice', 'payment', 'charged', 'billing',
  'your bill', 'amount due', 'total:', 'transaction',
  'paid', 'charge of', 'payment of', 'debited',
  'subscription renew', 'renewal', 'auto-renew', 'recurring',
  'next billing', 'billing period', 'billing cycle',
  'payment confirmation', 'payment received', 'successfully charged',
  'your receipt', 'monthly charge', 'annual charge',
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
      // Domain matches but no specific product keyword found
      return null
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
// BODY DECODING & PRICE EXTRACTION
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
            // Add spaces around block elements before stripping
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

function extractAmount(text) {
  const patterns = [
    /(?:CA)?\$\s?(\d{1,5}\.\d{2})/g,
    /USD\s?(\d{1,5}\.\d{2})/gi,
    /CAD\s?(\d{1,5}\.\d{2})/gi,
    /(\d{1,5}\.\d{2})\s?(?:USD|CAD)/gi,
  ]

  const amounts = []
  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      const val = parseFloat(match[1])
      if (val > 0.50 && val < 1000) { // Min $0.50 to avoid matching version numbers
        amounts.push(val)
      }
    }
  }

  if (amounts.length === 0) return null

  const countMap = {}
  for (const a of amounts) {
    countMap[a] = (countMap[a] || 0) + 1
  }
  const sorted = Object.entries(countMap).sort((a, b) => b[1] - a[1])
  return parseFloat(sorted[0][0])
}

function detectBillingCycle(text) {
  const lower = text.toLowerCase()
  if (lower.includes('annual') || lower.includes('yearly') || lower.includes('/year') || lower.includes('per year') || lower.includes('/yr') || lower.includes('12-month')) return 'yearly'
  if (lower.includes('quarter') || lower.includes('/quarter') || lower.includes('3-month')) return 'quarterly'
  if (lower.includes('weekly') || lower.includes('/week')) return 'weekly'
  return 'monthly'
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
    const skip = ['noreply', 'billing', 'no-reply', 'receipt', 'support', 'payments', 'info', 'team', 'hello', 'notifications', 'mailer', 'do-not-reply', 'alert']
    if (!skip.some(s => name.toLowerCase().includes(s))) {
      return name
    }
  }
  const domainMatch = from.match(/@([^.>]+)/)
  if (domainMatch) {
    const domain = domainMatch[1]
    const skip = ['gmail', 'yahoo', 'outlook', 'hotmail', 'mail', 'email', 'send', 'bounce']
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
// FREQUENCY ANALYSIS (core of V3)
// ═══════════════════════════════════════════════════════

/**
 * Analyze a group of emails from the same sender domain
 * Returns { isRecurring, confidence, cycle, intervalDays }
 */
function analyzeFrequency(emailDates) {
  if (emailDates.length < 2) {
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

  // Check for monthly pattern (25-35 day intervals)
  const monthlyIntervals = intervals.filter(d => d >= 20 && d <= 40)
  if (monthlyIntervals.length >= intervals.length * 0.6) {
    const confidence = emailDates.length >= 3 ? 'high' : 'medium'
    return { isRecurring: true, confidence, cycle: 'monthly', intervalDays: avgInterval }
  }

  // Check for quarterly pattern (80-100 day intervals)
  const quarterlyIntervals = intervals.filter(d => d >= 75 && d <= 105)
  if (quarterlyIntervals.length >= intervals.length * 0.5) {
    const confidence = emailDates.length >= 3 ? 'high' : 'medium'
    return { isRecurring: true, confidence, cycle: 'quarterly', intervalDays: avgInterval }
  }

  // Check for yearly pattern (340-390 day intervals)
  const yearlyIntervals = intervals.filter(d => d >= 340 && d <= 400)
  if (yearlyIntervals.length >= 1) {
    return { isRecurring: true, confidence: 'medium', cycle: 'yearly', intervalDays: avgInterval }
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

  const months = options.months || 6

  // ════════════════════════════════════════════════
  // PHASE 1: Search for billing/receipt emails
  // ════════════════════════════════════════════════
  if (onProgress) onProgress({ phase: 1, message: 'Searching billing emails...', current: 0, total: 0 })

  const query = [
    '(subject:(receipt OR invoice OR "payment confirmation" OR "billing statement"',
    'OR "your bill" OR "payment received" OR "successfully charged"',
    'OR "subscription renewed" OR "renewal" OR "auto-renew"',
    'OR "amount charged" OR "transaction" OR "monthly charge"',
    'OR "your receipt" OR "recurring payment" OR "billing period"))',
    `newer_than:${months}m`,
    '-category:promotions',
    '-category:social',
  ].join(' ')

  const messages = await searchAllMessages(token, query, 500)

  if (messages.length === 0) {
    return { confirmed: [], needsReview: [] }
  }

  if (onProgress) onProgress({ phase: 1, message: `Found ${messages.length} billing emails`, current: messages.length, total: messages.length })

  // ════════════════════════════════════════════════
  // PHASE 2: Get metadata & group by sender domain
  // ════════════════════════════════════════════════
  if (onProgress) onProgress({ phase: 2, message: 'Analyzing senders...', current: 0, total: messages.length })

  // Group: { "spotify.com": [{ id, from, subject, date }, ...] }
  const senderGroups = {}
  const batchSize = 10 // Process in batches to avoid rate limits

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
      const domain = extractRootDomain(from)

      if (!domain) continue

      // Skip blocklisted senders
      if (isBlocklisted(domain, from, subject)) continue

      // Skip one-time purchase emails
      if (hasOneTimeIndicators(subject)) continue

      if (!senderGroups[domain]) senderGroups[domain] = []
      senderGroups[domain].push({
        id: msg.id,
        from,
        subject,
        date: new Date(dateStr),
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

  const passedDomains = [] // Domains that pass frequency analysis

  let analyzed = 0
  for (const [domain, emails] of Object.entries(senderGroups)) {
    analyzed++

    const isKnown = matchKnownService(domain, emails[0]?.subject || '') !== null
    const dates = emails.map(e => e.date)
    const freq = analyzeFrequency(dates)

    if (freq.isRecurring) {
      // Recurring pattern detected
      passedDomains.push({ domain, emails, frequency: freq, isKnown })
    } else if (isKnown && emails.length >= 1) {
      // Known service with only 1 email — might be yearly or newly subscribed
      // Check if the email subject has billing evidence
      const hasBilling = emails.some(e => hasBillingEvidence(e.subject))
      if (hasBilling) {
        passedDomains.push({
          domain,
          emails,
          frequency: { isRecurring: false, confidence: 'low', cycle: detectBillingCycle(emails[0].subject), intervalDays: null },
          isKnown,
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
  // PHASE 4: Extract details from full email body
  // ════════════════════════════════════════════════
  if (onProgress) onProgress({ phase: 4, message: 'Extracting prices...', current: 0, total: passedDomains.length })

  const confirmed = []
  const needsReview = []

  for (let i = 0; i < passedDomains.length; i++) {
    const { domain, emails, frequency, isKnown } = passedDomains[i]

    // Get the most recent email's full content for price extraction
    const newestEmail = emails.sort((a, b) => b.date - a.date)[0]
    const fullMsg = await getFullMessage(token, newestEmail.id)

    let amount = null
    let bodyText = ''

    if (fullMsg) {
      bodyText = decodeBody(fullMsg.payload)
      const fullText = `${newestEmail.subject} ${bodyText}`
      amount = extractAmount(fullText)

      // If no price found, try second-newest email
      if (amount === null && emails.length >= 2) {
        const secondEmail = emails.sort((a, b) => b.date - a.date)[1]
        const secondMsg = await getFullMessage(token, secondEmail.id)
        if (secondMsg) {
          const secondBody = decodeBody(secondMsg.payload)
          amount = extractAmount(`${secondEmail.subject} ${secondBody}`)
        }
      }
    }

    // Determine service name, category, logo
    const knownInfo = matchKnownService(domain, newestEmail.subject)
    const serviceName = knownInfo?.name || extractServiceName(newestEmail.from) || domain
    const category = knownInfo?.category || 'other'
    const logoDomain = knownInfo?.logo || domain
    const cycle = frequency.cycle || detectBillingCycle(`${newestEmail.subject} ${bodyText}`)

    const subscription = {
      name: serviceName,
      category,
      amount: amount || null, // null = not extracted (not $0)
      currency: 'CAD',
      billing_cycle: cycle,
      status: 'active',
      next_billing_date: null,
      logo_url: getLogoUrl(logoDomain),
      notes: 'Found via inbox scan',
      // Metadata for review UI
      _emailCount: emails.length,
      _confidence: frequency.confidence,
      _domain: domain,
    }

    if (isKnown && frequency.confidence !== 'low') {
      confirmed.push(subscription)
    } else if (isKnown && frequency.confidence === 'low') {
      needsReview.push(subscription)
    } else {
      // Unknown service — always needs review
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
