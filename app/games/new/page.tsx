import { createGame } from "@/app/actions";
import TzField from "@/components/TzField";

export default async function NewGame({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <section className="section">
      <div className="narrow">
        <span className="eyebrow">Open invite</span>
        <h1><span className="gold-text">I want to play</span></h1>
        <p className="lede">Post a table for the club to see. You hold the first seat.</p>
        <div className="card">
          <form className="stack" action={createGame}>
            <label>Title
              <input name="title" required maxLength={80} placeholder="Sunday social, beginners welcome" />
            </label>
            <div className="row-2">
              <label>Date and time
                <input name="starts_at" type="datetime-local" required />
              </label>
              <label>Seats at the table
                <select name="seats" defaultValue="4">
                  <option value="4">4 players</option>
                  <option value="3">3 players</option>
                  <option value="2">2 players</option>
                </select>
              </label>
            </div>
            <div className="row-2">
              <label>Where
                <input name="location_name" required maxLength={100} placeholder="Venue or neighborhood" />
              </label>
              <label>City
                <input name="city" placeholder="Charlotte" />
              </label>
            </div>
            <div className="row-2">
              <label>Style
                <select name="style" defaultValue="american">
                  <option value="american">American (NMJL)</option>
                  <option value="riichi">Riichi</option>
                  <option value="hong_kong">Hong Kong</option>
                  <option value="chinese_official">Chinese Official</option>
                  <option value="any">Any style</option>
                </select>
              </label>
              <label>Level
                <select name="skill" defaultValue="any">
                  <option value="any">All levels</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </label>
            </div>
            <label>Notes (optional)
              <textarea name="notes" placeholder="Cards provided, bring a snack, parking tips…" />
            </label>
            <TzField />
            {error && <div className="notice notice-error" role="alert">{error}</div>}
            <button className="btn btn-primary" type="submit">Post invite</button>
          </form>
        </div>
      </div>
    </section>
  );
}
