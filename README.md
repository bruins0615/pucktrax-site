PuckTrax

PuckTrax is a hockey analytics tool that allows users to query NHL player statistics over customizable timeframes and matchups.

Example question the tool can answer:

How many shots has Pavel Zacha taken in the last 10 games vs Tampa Bay?

The goal is to provide a fast, intuitive interface for answering hockey stat questions without digging through multiple pages of box scores.

⸻

Current Feature: Player Cards

Route: /player-cards

Allows users to:
	•	Search any NHL player
	•	Select a timeframe (last 5, last 10, season, etc.)
	•	Filter by opponent
	•	Choose stat categories
	•	View totals and a game-by-game breakdown

Example stats currently supported:
	•	Goals
	•	Assists
	•	Points
	•	Shots
	•	Time on Ice

Additional stats will be added over time.

⸻

Tech Stack

Frontend
	•	Next.js
	•	React
	•	Tailwind CSS

Backend
	•	Next.js API routes

Deployment
	•	GitHub
	•	Vercel

Data
	•	NHL public API

⸻

Project Structure

Main application code lives in the app folder.

Homepage

app/page.js

Landing page for the site.

⸻

Player Cards UI

app/player-cards/page.js

Controls:
	•	player search UI
	•	filters
	•	stat selection
	•	query submission
	•	results display

This is the main frontend file for the tool.

⸻

Player Search API

app/api/nhl/search/route.js

Handles player search suggestions when typing a name.

⸻

Stats Query Engine

app/api/nhl/query/route.js

Core logic for the tool.

Responsible for:
	•	retrieving player game logs
	•	filtering games by timeframe
	•	filtering by opponent
	•	computing stat totals
	•	returning results to the frontend

⸻

Global Layout

app/layout.js

Controls site metadata:
	•	page title
	•	description
	•	favicon
	•	layout shell

⸻

Static Assets

public/

Contains images such as:
	•	logo
	•	favicon
	•	future graphics

⸻

Running the Project Locally

1. Open the project

Open the project folder:

~/dev/pucktrax-site

in VS Code.

⸻

2. Start the development server

Open a terminal and run:

npm run dev

You should see:

Local: http://localhost:3000

⸻

3. Open the site

Homepage:

http://localhost:3000

Player Cards tool:

http://localhost:3000/player-cards

⸻

Development Workflow

Start working

Run:

npm run dev

⸻

Make code changes

Edit the relevant files:

Homepage
app/page.js

Player Cards UI
app/player-cards/page.js

Player search API
app/api/nhl/search/route.js

Stats query engine
app/api/nhl/query/route.js

⸻

Save work to GitHub

Open a second terminal and run:

git status
git add -A
git commit -m “describe your changes”
git push

Example:

git commit -m “added hits and blocked shots to player cards”

⸻

Deployment

Deployment is handled automatically through Vercel.

Workflow:

Local machine → GitHub → Vercel → pucktrax.com

After pushing code with:

git push

Vercel will automatically build and deploy the updated site.

⸻

Common Issues

Dev server won’t start

Run:

npm install
npm run dev

⸻

Site won’t load locally

Make sure the dev server is still running and showing:

http://localhost:3000

If not, restart with:

npm run dev

⸻

Favicon changes not appearing

Safari caches favicons aggressively.

Try:
	•	Develop → Empty Caches
	•	Hard refresh
	•	Open a private window

⸻

Roadmap Ideas

Near-term improvements:
	•	Add more stats (hits, blocks, PIM)
	•	Format time on ice as mm:ss
	•	Improve the answer sentence formatting
	•	Add homepage navigation to Player Cards

Future ideas:
	•	Team matchup analysis
	•	Streak detection
	•	Game-by-game trend visualization
	•	Shareable stat queries
	•	Advanced analytics and NHL EDGE data

⸻

Development Philosophy

The focus of PuckTrax is simplicity:
	•	Ask a hockey stat question
	•	Get an immediate answer
	•	View the supporting data

The interface should make answering hockey stat questions as fast as possible.