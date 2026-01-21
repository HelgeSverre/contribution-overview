#!/bin/bash
# Fetch GitHub contribution data via gh CLI
# Usage: ./fetch-data.sh <username> [from-date] [to-date]
# Example: ./fetch-data.sh octocat
# Example: ./fetch-data.sh octocat 2024-01-01 2024-12-31

set -e

USERNAME="${1:-}"
FROM_DATE="${2:-}"
TO_DATE="${3:-}"

if [ -z "$USERNAME" ]; then
    echo "Usage: ./fetch-data.sh <username> [from-date] [to-date]"
    echo ""
    echo "Examples:"
    echo "  ./fetch-data.sh octocat              # Last year"
    echo "  ./fetch-data.sh octocat 2024-01-01   # From date to now"
    echo "  ./fetch-data.sh octocat 2024-01-01 2024-06-30  # Custom range"
    exit 1
fi

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo "Error: GitHub CLI (gh) is not installed."
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "Error: Not authenticated with GitHub CLI."
    echo "Run: gh auth login"
    exit 1
fi

# Calculate date range
if [ -z "$TO_DATE" ]; then
    NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
else
    NOW="${TO_DATE}T23:59:59Z"
fi

if [ -z "$FROM_DATE" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        ONE_YEAR_AGO=$(date -u -v-1y +"%Y-%m-%dT%H:%M:%SZ")
    else
        ONE_YEAR_AGO=$(date -u -d "1 year ago" +"%Y-%m-%dT%H:%M:%SZ")
    fi
else
    ONE_YEAR_AGO="${FROM_DATE}T00:00:00Z"
fi

echo "Fetching contribution data for $USERNAME..."
echo "Date range: $ONE_YEAR_AGO to $NOW"

# GraphQL query
QUERY='
query($username: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $username) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            date
            contributionCount
          }
        }
      }
      commitContributionsByRepository(maxRepositories: 100) {
        repository {
          name
          nameWithOwner
          isPrivate
        }
        contributions {
          totalCount
        }
      }
    }
  }
}
'

# Execute the query
gh api graphql \
    -f query="$QUERY" \
    -f username="$USERNAME" \
    -f from="$ONE_YEAR_AGO" \
    -f to="$NOW" \
    > data.json

if [ $? -eq 0 ]; then
    TOTAL=$(cat data.json | grep -o '"totalContributions":[0-9]*' | grep -o '[0-9]*')
    echo ""
    echo "Success! Saved to data.json"
    echo "Total contributions: $TOTAL"
    echo ""
    echo "Open index.html in your browser and enable 'Use local data.json file' in settings."
else
    echo "Error fetching data"
    exit 1
fi
