export interface Example {
  name: string;
  description: string;
  source: string;
}

export const EXAMPLES: Example[] = [
  {
    name: 'Login form',
    description: 'Sign-in card with fields and buttons',
    source: `@spec 1
@page "Login" light

@card "Welcome back"
  @subtitle "Sign in to your account"
  @field email "Email address"
  @field password "Password" secret
  @checkbox "Remember me"
  @button "Sign in" primary
  @divider "or"
  @button "Continue with Google" secondary
  @link "Don't have an account? Sign up"
@end`,
  },
  {
    name: 'Dashboard',
    description: 'Stats, alerts and data table',
    source: `@spec 1
@page "Dashboard" light

@card
  @stat-row
    @stat "Revenue" "$48,295" positive
    @stat "Users" "12,480" positive
    @stat "Churn" "2.4%" negative
    @stat "Uptime" "99.9%" neutral
  @end
@end

@card "Recent alerts"
  @alert "Deployment succeeded — v2.1.4 is live" success
  @alert "High memory usage on worker-03 (87%)" warning
  @alert "Scheduled maintenance window tonight 02:00 UTC" info
@end

@card "Top pages"
  @table
    @row "Page" "Views" "Bounce"
    @row "/dashboard" "8,421" "24%"
    @row "/settings" "3,102" "41%"
    @row "/billing" "1,890" "18%"
  @end
@end`,
  },
  {
    name: 'Profile card',
    description: 'User profile with stats',
    source: `@spec 1
@page "Profile" light

@card "Profile"
  @layout center
  @avatar "AK"
  @title "Alex Kim" lg
  @subtitle "Senior Engineer · Acme Corp" muted
  @divider spacious
  @stat-row
    @stat "Commits" "1,204" neutral
    @stat "PRs" "348" neutral
    @stat "Reviews" "892" neutral
  @end
  @divider spacious
  @layout inline
  @button "Message" primary
  @button "Follow" ghost
@end`,
  },
  {
    name: 'Settings page',
    description: 'Form with sections and toggles',
    source: `@spec 1
@page "Settings" light

@card "Account"
  @field text "Full name" value="Alex Kim"
  @field email "Email address" value="alex@example.com"
  @button "Save changes" primary
@end

@card "Notifications"
  @checkbox "Email me on new comments" checked
  @checkbox "Weekly digest"
  @checkbox "Security alerts" checked
  @button "Update preferences" secondary
@end

@card "Danger zone"
  @alert "Deleting your account is permanent and cannot be undone." warning
  @button "Delete account" danger
@end`,
  },
  {
    name: 'Minimal card',
    description: 'Hello world starter',
    source: `@spec 1
@page "Hello" light

@card "Hello, XVML"
  @title "It works!"
  @text "Edit the source on the left to see live changes."
  @button "Get started" primary
@end`,
  },
];
