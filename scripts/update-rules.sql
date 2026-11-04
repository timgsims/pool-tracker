UPDATE rules SET content = $RULES$# Official 8-Ball Pool - Simsey's Garage House Rules

## Objective
The goal is to pocket all balls from your assigned group (either solids or stripes) and finish by legally pocketing the 8-ball.

## Setup
- Rack the balls with the 8-ball in the centre of the triangle, a solid in one back corner and a stripe in the other.
- The cue ball is placed behind the head string for the break.

## Gameplay

### Break Shot
- The player breaking must either pocket a ball or drive at least four balls to the rail. If the 8-ball is pocketed on the break, it's either a win or a re-rack (player's choice).
- A foul break allows the opponent to re-break.
- If you pocket a ball on the break: You are awarded another turn. However, the table remains "open," meaning you can target either solids or stripes during your next shot.

### Determining Groups
- Pocketing a ball on the break does NOT determine groups. The table remains "open" until a ball is legally pocketed on a subsequent shot.
- If a player fails to legally pocket a ball on their follow-up shot after the break, the table remains open for the opponent.

### Legal Shots
- The cue ball must strike one of your group's balls first (once groups are determined) and either pocket it or drive any ball to the rail.

### Turn Progression
- A player's turn continues until they fail to pocket a ball legally. Foul or miss means the opponent takes over.

### Ball-in-Hand Rule
- If the opponent commits a foul, you are awarded "ball-in-hand," allowing you to place the cue ball anywhere on the table to take your next shot. This rule provides a strategic advantage, particularly for clearing difficult setups.

## Fouls
- Failing to hit your designated group's ball first (once groups are set).
- No ball touches the rail after contact.
- Cue ball is pocketed.
- Striking the 8-ball first when it's not the final ball.
- Cue ball is hit off the table or jumped off the table.

## When a Ball Leaves the Table
- If any object ball (solid or stripe) is jumped off the table, it is considered a foul, and the ball is **removed from play** (it is not re-spotted).
- If the 8-ball leaves the table, it results in an automatic loss for the player who committed the foul.

## Pocketing the Opponent's Ball
- If you accidentally pocket an opponent's ball, it stays down and counts in their favour — this is not a foul in itself.
- It becomes a foul only if you strike the opponent's ball first AND pocket both your opponent's ball and one of your own on the same shot.

## Winning
- Legally pocket the 8-ball after clearing all your group's balls.
- If the 8-ball is pocketed out of turn or in a foul manner, you lose immediately.

---

# Club Rankings (ELO System)

All club members are ranked using the **ELO rating system** — the same method used in chess and many competitive sports.

## How It Works
- Every player starts with a rating of **1000**.
- After each game, points are transferred from the loser to the winner.
- The amount transferred depends on how surprising the result was.

## Points Won and Lost
- **Beat a higher-rated player** → you gain more points; they lose more.
- **Beat a lower-rated player** → you gain fewer points; they lose fewer.
- **Lose to a higher-rated player** → you lose fewer points.
- **Lose to a lower-rated player** → you lose more points.

In short: **upsets are rewarded heavily, expected results move ratings only slightly.**

## Key Rules
- Ratings only update after a completed, legitimate game.
- Forfeited or abandoned games do not count toward ratings.
- Your rating is visible to all club members and updated after every session.

## Technical Detail

For those curious about the exact mechanics, here is how the system is calculated.

### Base K-Factor
The maximum points that can change in a single match is controlled by the **K-factor**, which starts at **32**. The actual points transferred are always less than this — determined by how expected the result was.

### Expected Score
Before each match, the system calculates how likely each player is to win based on the rating gap:

> **Expected Score = 1 ÷ (1 + 10^((opponent rating − your rating) ÷ 400))**

- A 200-point gap gives the higher-rated player roughly a **76%** expected win probability.
- A 400-point gap gives roughly a **91%** expected win probability.

### Points Transferred
> **Points gained by winner = K × (1 − Expected Score)**

So if you were expected to win (Expected Score close to 1), you gain very few points. If you were the underdog (Expected Score close to 0), you gain close to the full K-factor.

The loser always drops by the same amount the winner gains — the total points in the system remain constant.

### Recency Weighting
Recent matches count for more than old ones. The K-factor is scaled down for older matches using an **exponential decay** with a **45-day half-life**:

> **K (effective) = 32 × decay factor**

- A match played today: full 32 K.
- A match played 45 days ago: effectively 16 K (half weight).
- A match played 90 days ago: effectively 8 K (quarter weight).
- The decay never drops below **25%** — even very old matches retain some influence.

This means your most recent performances carry more weight in your current rating.

### Provisional Ratings
Players with **fewer than 5 matches** are considered **provisional**. Their rating is displayed as `~rating` in a muted style and they are listed separately on the leaderboard below established players. This prevents a player with one lucky win from appearing at the top of the standings.

## Seasons
- Rankings reset to **1000** at the start of each new season — everyone begins on equal footing.
- At the end of the season, the **top-ranked players qualify as finalists** for the season championship.
- All seasonal results also feed into a separate **All-Time ELO ranking**, which is never reset and serves as the permanent record of each player's overall standing in the club's history.
$RULES$, updated_at = now() WHERE id = 1;
