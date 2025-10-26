# Linear Project Template

This template provides a structured format for creating self-descriptive Linear projects.

## Template Structure

```markdown
## Overview
[One-liner description repeated]

## Primary Objective
[High-level goal this project aims to achieve]

## Business Value
[What this should do for the business]

## Customer Value
[What this should do for the customer]

## Scope
**In Scope:**
- [Item 1]
- [Item 2]
- [Item 3]

**Out of Scope:**
- [Item 1]
- [Item 2]
```

---

## Example: E-commerce Checkout Redesign

**One-liner description:**
> Streamline the checkout flow to reduce cart abandonment and increase conversion rates

**Content (markdown):**

```markdown
## Overview
Streamline the checkout flow to reduce cart abandonment and increase conversion rates

## Primary Objective
Redesign the checkout experience to minimize friction and maximize completed purchases.

## Business Value
- Reduce checkout abandonment rate from 68% to under 50%
- Target an additional $2M in annual revenue through improved conversion
- Decrease customer support tickets related to checkout issues by 35%
- Reduce payment processing failures from 8% to under 3%

## Customer Value
Faster, simpler checkout experience that reduces friction and time-to-purchase.
Customers can complete their order in 3 steps instead of 7, with saved payment
methods and one-click address autofill. Clear progress indicators and real-time
validation prevent errors and frustration.

## Scope
**In Scope:**
- Single-page checkout flow with real-time validation
- Guest checkout option (no account required)
- Apple Pay and Google Pay integration
- Address autocomplete via Google Places API
- Mobile-optimized responsive design
- Progress indicator and error handling

**Out of Scope:**
- Internationalization (shipping outside US)
- Subscription/recurring payment options
- Gift card purchases
- Custom gift wrapping options
- In-store pickup coordination
```

---

## Example: API Rate Limiting System

**One-liner description:**
> Implement API rate limiting to protect infrastructure and enable tiered pricing

**Content (markdown):**

```markdown
## Overview
Implement API rate limiting to protect infrastructure and enable tiered pricing

## Primary Objective
Protect backend services from overload while establishing foundation for usage-based pricing tiers.

## Business Value
- Prevent infrastructure overload and reduce server costs by 25%
- Enable transition from flat-rate to tiered pricing model
- Project 40% increase in API product revenue through tiered pricing
- Reduce unplanned downtime from API abuse
- Create upsell opportunities through usage tier visibility

## Customer Value
Fair, predictable API access with clear tier boundaries and real-time usage metrics.
Developers get dashboard visibility into their API consumption, can monitor usage
patterns, and upgrade tiers seamlessly when needed. Clear rate limit headers help
developers build retry logic and avoid service disruptions.

## Scope
**In Scope:**
- Token bucket rate limiting algorithm
- Per-API-key rate limit enforcement
- Usage dashboard for customers
- Rate limit headers in API responses (X-RateLimit-*)
- Graceful degradation with retry-after guidance
- Support for 3 pricing tiers (Free, Pro, Enterprise)

**Out of Scope:**
- Burst credits or rollover allowances
- Custom rate limit negotiation (handled via sales)
- Rate limit alerts/notifications
- Historical usage analytics (beyond current billing period)
- GraphQL query complexity limits
```

---

## Usage

When creating a new Linear project:

1. Use the **one-liner description** for the project's `description` field
2. Use the template structure for the project's `content` field (markdown)
3. Fill in each section with specific details for your project

### With linear-create CLI

```bash
# Create project with description
linear-create project create \
  --title "My Project" \
  --description "One-liner description here" \
  --content "$(cat project_content.md)"
```

Or use the interactive mode to fill in the template:

```bash
linear-create project create --interactive
```
