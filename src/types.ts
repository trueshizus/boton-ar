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

export type RedditThing = {
  kind: "t1" | "t3"; // t1 = comment, t3 = post
  data: CommentData | PostData;
};

export interface CommentData {
  subreddit_id: string;
  approved_at_utc: number | null;
  author: string;
  author_is_blocked: boolean;
  comment_type: string | null;
  created_utc: number;
  body: string;
  body_html: string;
  score: number;
  permalink: string;
  link_id: string;
  link_title: string;
  subreddit: string;
  subreddit_name_prefixed: string;
  id: string;
  author_fullname: string;
  removed: boolean;
  spam: boolean;
  banned_by: string | null;
  mod_note: string | null;
  distinguished: string | null;
  likes: boolean | null;
  replies: string;
  user_reports: Array<[string, number, boolean, boolean]>;
  mod_reports: string[];
  num_reports: number;
}

export interface PostData {
  subreddit_id: string;
  author: string;
  title: string;
  selftext: string;
  selftext_html: string;
  score: number;
  created_utc: number;
  permalink: string;
  id: string;
  author_fullname: string;
  subreddit: string;
  subreddit_name_prefixed: string;
  num_comments: number;
  removed: boolean;
  spam: boolean;
  banned_by: boolean | null;
  likes: boolean | null;
  user_reports: Array<[string, number, boolean, boolean]>;
  mod_reports: string[];
  // ... other post fields
}
