# Landing Page LaunchKit Refresh

## Overview

Review and enhance the `/docs/index.html` landing page using LaunchKit elements and Pragmatic Technical Writing style (Hunt/Thomas, Joel Spolsky). The current implementation is strong but can be refined section-by-section.

## Current State Assessment

### What's Working Well
- Specific, outcome-focused hero headline ("12 expert opinions in 30 seconds")
- Developer-authentic copywriting (N+1 queries, CORS, SQL injection)
- Stats section with clear metrics (23 agents, 16 commands, 11 skills, 2 MCP servers)
- Philosophy section with concrete story (N+1 query bug)
- Three-step installation with actual commands
- FAQ accordion following LaunchKit patterns
- Categorized feature sections with code examples

### Missing Elements (From Best Practices Research)
1. **Social Proof Section** - No testimonials, GitHub stars, or user metrics
2. **Visual Demo** - No GIF/animation showing the tool in action
3. **Arrow icons on CTAs** - 26% conversion boost from studies
4. **Trust indicators** - Open source badge, license info

---

## Section-by-Section Review Plan

### 1. Hero Section (lines 56-78)

**Current:**
```html
<h1>Your Code Reviews Just Got 12 Expert Opinions. In 30 Seconds.</h1>
```

**Review Checklist:**
- [ ] Headline follows Pragmatic Writing (concrete before abstract) ✅
- [ ] Eyebrow badge is current (Version 2.6.0) - verify
- [ ] Description paragraph under 3 sentences ✅
- [ ] Button group has arrow icon on primary CTA
- [ ] "Read the Docs" secondary CTA present ✅

**Potential Improvements:**
- Add `→` arrow to "Install Plugin" button
- Consider adding animated terminal GIF below buttons showing `/review` in action

### 2. Stats Section (lines 81-104)

**Current:** 4 stat cards (23 agents, 16 commands, 11 skills, 2 MCP servers)

**Review Checklist:**
- [ ] Numbers are accurate (verify against actual file counts)
- [ ] Icons are appropriate for each stat
- [ ] Hover effects working properly
- [ ] Mobile layout (2x2 grid) is readable

**Potential Improvements:**
- Add "developers using" or "reviews run" metric if available
- Consider adding subtle animation on scroll

### 3. Philosophy Section (lines 107-192)

**Current:** "Why Your Third Code Review Should Be Easier Than Your First" with N+1 query story

**Review Checklist:**
- [ ] Opens with concrete story (N+1 query) ✅
- [ ] Quote block is memorable and quotable
- [ ] Four pillars (Plan, Delegate, Assess, Codify) are clear
- [ ] Each pillar has: tagline, description, tool tags
- [ ] Descriptions use "you" voice ✅

**Potential Improvements:**
- Review pillar descriptions for passive voice
- Ensure each pillar description follows PAS (Problem, Agitate, Solve) pattern
- Check tool tags are accurate and current

### 4. Agents Section (lines 195-423)

**Current:** 23 agents in 5 categories (Review, Research, Design, Workflow, Docs)

**Review Checklist:**
- [ ] All 23 agents are listed (count actual files)
- [ ] Categories are logical and scannable
- [ ] Each card has: name, badge, description, usage code
- [ ] Descriptions are conversational (not passive)
- [ ] Critical badges (Security, Data) stand out

**Potential Improvements:**
- Review agent descriptions against pragmatic writing checklist
- Ensure descriptions answer "when would I use this?"
- Add concrete scenarios to generic descriptions

### 5. Commands Section (lines 426-561)

**Current:** 16 commands in 2 categories (Workflow, Utility)

**Review Checklist:**
- [ ] All 16 commands are listed (count actual files)
- [ ] Core workflow commands are highlighted
- [ ] Descriptions are action-oriented
- [ ] Command names match actual implementation

**Potential Improvements:**
- Review command descriptions for passive voice
- Lead with outcomes, not features
- Add "saves you X minutes" framing where appropriate

### 6. Skills Section (lines 564-703)

**Current:** 11 skills in 3 categories (Development, Content/Workflow, Image Generation)

**Review Checklist:**
- [ ] All 11 skills are listed (count actual directories)
- [ ] Featured skill (gemini-imagegen) is properly highlighted
- [ ] API key requirement is clear
- [ ] Skill invocation syntax is correct

**Potential Improvements:**
- Review skill descriptions against pragmatic writing
- Ensure each skill answers "what problem does this solve?"

### 7. MCP Servers Section (lines 706-751)

**Current:** 2 MCP servers (Playwright, Context7)

**Review Checklist:**
- [ ] Tool lists are accurate
- [ ] Descriptions explain WHY not just WHAT
- [ ] Framework support list is current (100+)

**Potential Improvements:**
- Add concrete example of each server in action
- Consider before/after comparison

### 8. Installation Section (lines 754-798)

**Current:** "Three Commands. Zero Configuration." with 3 steps

**Review Checklist:**
- [ ] Commands are accurate and work
- [ ] Step 3 shows actual usage examples
- [ ] Timeline visual (vertical line) renders correctly
- [ ] Copy buttons work on code blocks

**Potential Improvements:**
- Add copy-to-clipboard functionality if missing
- Consider adding "What you'll see" output example

### 9. FAQ Section (lines 801-864)

**Current:** 5 questions in accordion format

**Review Checklist:**
- [ ] Questions address real objections
- [ ] Answers are conversational (use "you")
- [ ] Accordion expand/collapse works
- [ ] No passive voice in answers

**Potential Improvements:**
- Review for weasel words ("best practices suggest")
- Ensure answers are direct and actionable

### 10. CTA Section (lines 868-886)

**Current:** "Install Once. Compound Forever." with Install + GitHub buttons

**Review Checklist:**
- [ ] Badge is eye-catching ("Free & Open Source")
- [ ] Headline restates core value proposition
- [ ] Primary CTA has arrow icon ✅
- [ ] Trust line at bottom

**Potential Improvements:**
- Review trust line copy
- Consider adding social proof element

---

## NEW: Social Proof Section (To Add)

**Position:** After Stats section, before Philosophy section

**Components:**
- GitHub stars counter (dynamic or static)
- "Trusted by X developers" metric
- 2-3 testimonial quotes (if available)
- Company logos (if applicable)

**LaunchKit Pattern:**
```html
<section class="social-proof-section">
  <div class="heading centered">
    <p class="paragraph m secondary">Trusted by developers at</p>
  </div>
  <div class="logo-grid">
    <!-- Company logos or GitHub badge -->
  </div>
</section>
```

---

## Pragmatic Writing Style Checklist (Apply to ALL Copy)

### The Five Laws
1. **Concrete Before Abstract** - Story/example first, then principle
2. **Physical Analogies** - Import metaphors readers understand
3. **Conversational Register** - Use "you", contractions, asides
4. **Numbered Frameworks** - Create referenceable structures
5. **Humor as Architecture** - Mental anchors for dense content

### Anti-Patterns to Find and Fix
- [ ] "It is recommended that..." → "Do this:"
- [ ] "Best practices suggest..." → "Here's what works:"
- [ ] Passive voice → Active voice
- [ ] Abstract claims → Specific examples
- [ ] Walls of text → Scannable lists

### Quality Checklist (Per Section)
- [ ] Opens with concrete story or example?
- [ ] Can reader skim headers and get the arc?
- [ ] Uses "you" at least once?
- [ ] Clear action reader can take?
- [ ] Reads aloud like speech?

---

## Implementation Phases

### Phase 1: Copy Audit (No HTML Changes)
1. Read through entire page
2. Flag passive voice instances
3. Flag abstract claims without examples
4. Flag missing "you" voice
5. Document improvements needed

### Phase 2: Copy Rewrites
1. Rewrite flagged sections following pragmatic style
2. Ensure each section passes quality checklist
3. Maintain existing HTML structure

### Phase 3: Component Additions
1. Add arrow icons to primary CTAs
2. Add social proof section (if data available)
3. Consider visual demo element

### Phase 4: Verification
1. Validate all counts (agents, commands, skills)
2. Test all links and buttons
3. Verify mobile responsiveness
4. Check accessibility

---

## Files to Modify

| File | Changes |
|------|---------|
| `docs/index.html` | Copy rewrites, potential new section |
| `docs/css/style.css` | Social proof styles (if adding) |

---

## Success Criteria

1. All copy passes Pragmatic Writing quality checklist
2. No passive voice in any description
3. Every feature section answers "why should I care?"
4. Stats are accurate against actual file counts
5. Page loads in <3 seconds
6. Mobile layout is fully functional

---

## References

- LaunchKit Template: https://launchkit.evilmartians.io/
- Pragmatic Writing Skill: `~/.claude/skills/pragmatic-writing-skill/SKILL.md`
- Current Landing Page: `/Users/kieranklaassen/every-marketplace/docs/index.html`
- Style CSS: `/Users/kieranklaassen/every-marketplace/docs/css/style.css`
