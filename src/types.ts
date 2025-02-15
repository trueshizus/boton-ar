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
