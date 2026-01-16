# Simple Card Game - Player Manual

A 2-player card game where you summon creatures to battle your opponent.

## Objective

Reduce your opponent's health from 20 to 0.

## Game Setup

- Each player starts with **20 health** and **1 mana**
- Each player has a **10-card deck** (shuffled)
- Each player draws **3 cards** to form their starting hand

## Turn Structure

Players alternate taking turns. On your turn, you can perform any of these actions in any order:

1. **Draw a card** from your deck (once per turn)
2. **Play cards** from your hand (if you have enough mana)
3. **Attack** with your creatures
4. **End your turn** to pass to your opponent

**Note**: You can only draw one card per turn.

### Mana System

- You gain **+1 mana** at the start of each of your turns (up to max 10)
- Mana is used to play cards from your hand
- Unspent mana carries over to your next turn

## Cards

### Card Anatomy

Each card has:
- **Name** - The card's identity
- **Cost** - Mana required to play (shown in blue)
- **Type** - Currently all cards are Creatures
- **Power** (⚔) - Damage dealt when attacking (red number)
- **Toughness** (🛡) - Health points (green number)

### Example Cards

| Card | Cost | Power | Toughness |
|------|------|-------|-----------|
| Goblin Scout | 1 | 1 | 1 |
| Forest Sprite | 1 | 1 | 2 |
| Iron Golem | 2 | 2 | 2 |
| Fire Elemental | 3 | 3 | 2 |
| Stone Giant | 4 | 4 | 4 |
| Dragon Whelp | 5 | 5 | 3 |

## Playing Cards

1. Click a card in your hand to select it (green border appears)
2. Check you have enough mana (shown as blue number)
3. Click the **"Play Selected"** button
4. The card moves to your board and the mana cost is deducted

**Summoning Sickness**: Creatures cannot attack on the turn they are played. They show "Sick" status until your next turn.

## Combat

### Attacking a Creature

1. Click one of your creatures on the board to select it
2. Click **"Attack Creature"** button
3. Click an enemy creature on the opponent's board
4. Both creatures deal damage equal to their power to each other

**Example**: Your 3/3 attacks their 2/4
- Their creature takes 3 damage (4→1 toughness)
- Your creature takes 2 damage (3→1 toughness)
- Both survive with 1 toughness

If a creature's toughness reaches 0, it dies and goes to the discard pile.

### Attacking the Player

1. Click one of your creatures on the board to select it
2. Click the **"Attack Player"** button next to your opponent's name
3. Your creature deals damage equal to its power to the opponent's health

**Note**: Creatures become **tapped** (slightly rotated) after attacking and cannot attack again until your next turn.

## Creatures Cannot Attack When...

- They have **summoning sickness** (just played this turn)
- They are **tapped** (already attacked this turn)

## Ending Your Turn

Click **"End Turn"** to:
- Untap all your creatures (ready to attack next turn)
- Pass control to your opponent
- Your opponent gains +1 mana and their creatures lose summoning sickness

## Winning the Game

The game ends when a player's health reaches 0. The other player wins!

## UI Guide

### Game Status Bar
Shows current turn number, phase, and active player.

### Player Panels
Each player has a panel showing:
- **Health** (red/green) - Your life total
- **Mana** (blue) - Available/maximum mana
- **Deck** - Cards remaining in deck
- **Board** - Creatures you control
- **Hand** - Cards you can play (only visible for active player)

### Action Buttons

| Button | Action |
|--------|--------|
| **Draw Card** | Draw the top card from your deck |
| **Play Selected** | Play the selected card from hand |
| **Attack Creature** | Attack an enemy creature with selected creature |
| **Attack Player** | Appears next to opponent - attack them directly |
| **End Turn** | End your turn |

### Visual Indicators

- **Green border** - Selected card/current player
- **Tapped (rotated)** - Creature has attacked this turn
- **"Sick" label** - Creature has summoning sickness
- **Faded appearance** - Creature cannot act

## Strategy Tips

1. **Manage your mana** - Save up for powerful creatures or play multiple small ones
2. **Trade efficiently** - Attack creatures where you deal more damage than you take
3. **Protect your health** - Sometimes it's better to block with creatures than take damage
4. **Summoning sickness matters** - Play creatures early so they can attack sooner
5. **Card advantage** - Drawing cards gives you more options

## Quick Reference

| Term | Meaning |
|------|---------|
| Mana | Resource used to play cards |
| Power | Damage a creature deals |
| Toughness | How much damage a creature can take |
| Tapped | Already used this turn (cannot attack) |
| Summoning Sickness | Cannot attack the turn it's played |
| Board | Area where your active creatures are |
| Hand | Cards you can play |
| Deck | Cards you draw from |
| Discard | Where dead creatures go |
