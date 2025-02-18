export interface RedditListing {
  kind: "Listing";
  data: ListingData;
}

export interface ListingData {
  after: string | null;
  dist: number;
  modhash: string | null;
  geo_filter: string | null;
  children: RedditThing[];
  before: string | null;
}

export type RedditThing =
  | {
      kind: "t1"; // t1 = comment, t3 = post
      data: CommentData;
    }
  | {
      kind: "t3";
      data: PostData;
    };

// Common fields shared between posts and comments
interface RedditCommonData {
  subreddit_id: string;
  author: string;
  author_fullname: string;
  score: number;
  created_utc: number;
  permalink: string;
  id: string;
  subreddit: string;
  subreddit_name_prefixed: string;
  removed: boolean;
  spam: boolean;
  banned_by: string | null;
  likes: boolean | null;
  user_reports: Array<[string, number, boolean, boolean]>;
  mod_reports: string[];
  author_flair_background_color: string | null;
  approved_at_utc: number | null;
  saved: boolean;
  mod_reason_title: string | null;
  gilded: number;
  banned_at_utc: number | null;
  approved_by: string | null;
  distinguished: string | null;
  mod_reason_by: string | null;
  author_flair_css_class: string | null;
  author_flair_richtext: any[];
  gildings: Record<string, any>;
  author_premium: boolean;
  can_gild: boolean;
  approved: boolean;
  author_flair_text_color: string | null;
  all_awardings: any[];
  author_flair_text: string | null;
  locked: boolean;
  author_flair_template_id: string | null;
  treatment_tags: string[];
  total_awards_received: number;
  awarders: any[];
  over_18: boolean;
  removal_reason: string | null;
  stickied: boolean;
  quarantine: boolean;
  num_comments: number;
  ignore_reports: boolean;
  send_replies: boolean;
}

export interface CommentData extends RedditCommonData {
  author_is_blocked: boolean;
  comment_type: string | null;
  body: string;
  body_html: string;
  link_id: string;
  link_title: string;
  replies: string;
  num_reports: number;
  edited: boolean;
  author_flair_type: string;
  link_author: string;
  archived: boolean;
  collapsed_reason_code: string | null;
  no_follow: boolean;
  parent_id: string;
  controversiality: number;
  collapsed: boolean;
  top_awarded_type: string | null;
  name: string;
  author_patreon_flair: boolean;
  downs: number;
  is_submitter: boolean;
  collapsed_reason: string | null;
  associated_award: string | null;
  unrepliable_reason: string | null;
  score_hidden: boolean;
  subreddit_type: string;
  link_permalink: string;
  report_reasons: string[];
  created: number;
  link_url: string;
  ups: number;
  collapsed_because_crowd_control: string | null;
}

export interface PostData extends RedditCommonData {
  title: string;
  selftext: string;
  selftext_html: string;
  clicked: boolean;
  link_flair_richtext: any[];
  hidden: boolean;
  pwls: number;
  link_flair_css_class: string | null;
  downs: number;
  top_awarded_type: string | null;
  hide_score: boolean;
  name: string;
  link_flair_text_color: string;
  upvote_ratio: number;
  subreddit_type: string;
  ups: number;
  media_embed: Record<string, any>;
  is_original_content: boolean;
  secure_media: any | null;
  is_reddit_media_domain: boolean;
  is_meta: boolean;
  category: string | null;
  secure_media_embed: Record<string, any>;
  link_flair_text: string | null;
  can_mod_post: boolean;
  is_created_from_ads_ui: boolean;
  thumbnail: string;
  edited: boolean;
  content_categories: string[] | null;
  is_self: boolean;
  created: number;
  link_flair_type: string;
  wls: number;
  removed_by_category: string | null;
  view_count: number | null;
  archived: boolean;
  no_follow: boolean;
  is_crosspostable: boolean;
  pinned: boolean;
  media_only: boolean;
  link_flair_template_id: string | null;
  spoiler: boolean;
  visited: boolean;
  removed_by: string | null;
  link_flair_background_color: string;
  ban_note: string | null;
  is_robot_indexable: boolean;
  report_reasons: string[] | null;
  discussion_type: string | null;
  media: any | null;
  contest_mode: boolean;
  author_patreon_flair: boolean;
  url: string;
  subreddit_subscribers: number;
  num_crossposts: number;
  is_video: boolean;
}

export type RedditMe = {
  is_employee: boolean;
  seen_layout_switch: boolean;
  has_visited_new_profile: boolean;
  pref_no_profanity: boolean;
  has_external_account: boolean;
  pref_geopopular: string;
  seen_redesign_modal: boolean;
  pref_show_trending: boolean;
  subreddit: {
    default_set: boolean;
    user_is_contributor: boolean;
    banner_img: string;
    restrict_posting: boolean;
    user_is_banned: boolean;
    free_form_reports: boolean;
    community_icon: string | null;
    show_media: boolean;
    icon_color: string;
    user_is_muted: boolean | null;
    display_name: string;
    header_img: string | null;
    title: string;
    coins: number;
    previous_names: string[];
    over_18: boolean;
    icon_size: [number, number];
    primary_color: string;
    icon_img: string;
    description: string;
    allowed_media_in_comments: unknown[]; // or more specific type, e.g. string[]
    submit_link_label: string;
    header_size: number | null;
    restrict_commenting: boolean;
    subscribers: number;
    submit_text_label: string;
    is_default_icon: boolean;
    link_flair_position: string;
    display_name_prefixed: string;
    key_color: string;
    name: string;
    is_default_banner: boolean;
    url: string;
    quarantine: boolean;
    banner_size: number | null;
    user_is_moderator: boolean;
    accept_followers: boolean;
    public_description: string;
    link_flair_enabled: boolean;
    disable_contributor_requests: boolean;
    subreddit_type: string;
    user_is_subscriber: boolean;
  };
  pref_show_presence: boolean;
  snoovatar_img: string;
  snoovatar_size: [number, number] | null;
  gold_expiration: null; // or number if it can be numeric
  has_gold_subscription: boolean;
  is_sponsor: boolean;
  num_friends: number;
  features: {
    modmail_harassment_filter: boolean;
    mod_service_mute_writes: boolean;
    promoted_trend_blanks: boolean;
    show_amp_link: boolean;
    chat: boolean;
    is_email_permission_required: boolean;
    mod_awards: boolean;
    expensive_coins_package: boolean;
    mweb_xpromo_revamp_v2: {
      owner: string;
      variant: string;
      experiment_id: number;
    };
    awards_on_streams: boolean;
    mweb_xpromo_modal_listing_click_daily_dismissible_ios: boolean;
    chat_subreddit: boolean;
    cookie_consent_banner: boolean;
    modlog_copyright_removal: boolean;
    show_nps_survey: boolean;
    do_not_track: boolean;
    images_in_comments: boolean;
    mod_service_mute_reads: boolean;
    chat_user_settings: boolean;
    use_pref_account_deployment: boolean;
    mweb_xpromo_interstitial_comments_ios: boolean;
    mweb_xpromo_modal_listing_click_daily_dismissible_android: boolean;
    premium_subscriptions_table: boolean;
    mweb_xpromo_interstitial_comments_android: boolean;
    crowd_control_for_post: boolean;
    chat_group_rollout: boolean;
    resized_styles_images: boolean;
    noreferrer_to_noopener: boolean;
  };
  can_edit_name: boolean;
  verified: boolean;
  new_modmail_exists: boolean;
  pref_autoplay: boolean;
  coins: number;
  has_paypal_subscription: boolean;
  has_subscribed_to_premium: boolean;
  id: string;
  has_stripe_subscription: boolean;
  oauth_client_id: string;
  can_create_subreddit: boolean;
  over_18: boolean;
  is_gold: boolean;
  is_mod: boolean;
  awarder_karma: number;
  suspension_expiration_utc: number | null;
  has_verified_email: boolean;
  is_suspended: boolean;
  pref_video_autoplay: boolean;
  in_chat: boolean;
  has_android_subscription: boolean;
  in_redesign_beta: boolean;
  icon_img: string;
  has_mod_mail: boolean;
  pref_nightmode: boolean;
  awardee_karma: number;
  hide_from_robots: boolean;
  password_set: boolean;
  link_karma: number;
  force_password_reset: boolean;
  total_karma: number;
  seen_give_award_tooltip: boolean;
  inbox_count: number;
  seen_premium_adblock_modal: boolean;
  pref_top_karma_subreddits: boolean;
  has_mail: boolean;
  pref_show_snoovatar: boolean;
  name: string;
  pref_clickgadget: number;
  created: number;
  gold_creddits: number;
  created_utc: number;
  has_ios_subscription: boolean;
  pref_show_twitter: boolean;
  in_beta: boolean;
  comment_karma: number;
  accept_followers: boolean;
  has_subscribed: boolean;
  linked_identities: string[];
  seen_subreddit_chat_ftux: boolean;
};

export interface RedditAbout {
  kind: "t5";
  data: {
    user_flair_background_color: string | null;
    submit_text_html: string | null;
    restrict_posting: boolean;
    user_is_banned: boolean;
    free_form_reports: boolean;
    wiki_enabled: boolean;
    user_is_muted: boolean;
    user_can_flair_in_sr: boolean;
    display_name: string;
    header_img: string | null;
    title: string;
    allow_galleries: boolean;
    icon_size: [number, number] | null;
    primary_color: string;
    active_user_count: number;
    icon_img: string;
    display_name_prefixed: string;
    accounts_active: number;
    public_traffic: boolean;
    subscribers: number;
    videostream_links_count: number;
    name: string;
    quarantine: boolean;
    hide_ads: boolean;
    emojis_enabled: boolean;
    advertiser_category: string;
    public_description: string;
    comment_score_hide_mins: number;
    user_has_favorited: boolean;
    user_flair_template_id: string | null;
    community_icon: string;
    banner_background_image: string;
    description_html: string;
    spoilers_enabled: boolean;
    header_size: [number, number] | null;
    user_flair_position: string;
    all_original_content: boolean;
    collections_enabled: boolean;
    is_enrolled_in_new_modmail: boolean;
    key_color: string;
    can_assign_user_flair: boolean;
    created: number;
    wls: number;
    show_media_preview: boolean;
    submission_type: string;
    user_is_subscriber: boolean;
    allowed_media_in_comments: any[];
    allow_videogifs: boolean;
    should_archive_posts: boolean;
    user_flair_type: string;
    allow_polls: boolean;
    collapse_deleted_comments: boolean;
    coins: number;
    public_description_html: string;
    allow_videos: boolean;
    is_crosspostable_subreddit: boolean;
    notification_level: string | null;
    can_assign_link_flair: boolean;
    accounts_active_is_fuzzed: boolean;
    submit_text_label: string;
    link_flair_position: string;
    user_sr_flair_enabled: boolean;
    user_flair_enabled_in_sr: boolean;
    allow_discovery: boolean;
    accept_followers: boolean;
    user_sr_theme_enabled: boolean;
    link_flair_enabled: boolean;
    disable_contributor_requests: boolean;
    subreddit_type: string;
    suggested_comment_sort: string | null;
    banner_img: string;
    user_flair_text: string | null;
    banner_background_color: string;
    show_media: boolean;
    id: string;
    user_is_moderator: boolean;
    over18: boolean;
    description: string;
    submit_link_label: string;
    user_flair_text_color: string | null;
    restrict_commenting: boolean;
    user_flair_css_class: string | null;
    allow_images: boolean;
    lang: string;
    url: string;
    created_utc: number;
    banner_size: [number, number] | null;
    mobile_banner_image: string;
    user_is_contributor: boolean;
  };
}

export interface ConversationsResponse {
  conversations: ConversationMap;
}

interface ConversationMap {
  // Reserved keys
  viewerId: string;
  conversationIds: string[];
  // Other keys are conversation objects indexed by their id
  [conversationId: string]: ConversationData | string | string[];
}

interface ConversationData {
  isAuto: boolean;
  participant: Participant;
  objIds: ObjId[];
  isRepliable: boolean;
  lastUserUpdate: string | null;
  isInternal: boolean;
  lastModUpdate: string | null;
  authors: Participant[];
  lastUpdated: string;
  participantSubreddit: Record<string, unknown>;
  legacyFirstMessageId: string;
  state: number;
  conversationType: string;
  lastUnread: string;
  owner: Owner;
  subject: string;
  id: string;
  isHighlighted: boolean;
  numMessages: number;
}

interface Participant {
  isMod: boolean;
  isAdmin: boolean;
  name: string;
  isOp: boolean;
  isParticipant: boolean;
  isApproved: boolean;
  isHidden: boolean;
  id: number;
  isDeleted: boolean;
}

interface Owner {
  displayName: string;
  type: string;
  id: string;
}

interface ObjId {
  id: string;
  key: string;
}
