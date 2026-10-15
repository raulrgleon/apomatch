# Auburn pilot: verified sources and open research

Consulted **2026-10-15**. Sources are government publishers except the school district's own site. URLs, retrieval dates, verification states and historical snapshots are retained in the database seed. Source pages do not always expose publication dates; unknown dates remain null, not guessed.

| Source                                                                | Imported scope                                                                  | Status / limits                                                                                                                                                  |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Auburn City Hall](https://auburn.ne.gov/city-hall/)                  | Auburn in Nemaha County; elected mayor/council; municipal information links     | Verified dated source. No officeholder contact details imported. Responsibilities are brief descriptions, not legal opinions.                                    |
| [Nebraska 2026 elections](https://sos.nebraska.gov/elections)         | General election date: 2026-11-03; canonical certification/calendar resource    | Verified statewide date. No candidate list, results or polling places imported.                                                                                  |
| [Nemaha Election Office](https://nemahacountyne.gov/election-office/) | Official county election authority/resource                                     | Verified resource link. No claim that a particular address is the user's polling place.                                                                          |
| [Elections Division](https://sos.nebraska.gov/elections-division)     | Access point for official registration, lookup, ID and early-voting information | Verified resource link. The app does not summarize individual eligibility.                                                                                       |
| [City maps](https://auburn.ne.gov/city-hall/maps/)                    | Official map resource                                                           | Verified link only. No geometry imported and no ward inferred from ZIP.                                                                                          |
| [Auburn Public Schools](https://www.auburnpublicschools.org/news)     | School district publisher identified during research                            | Not imported as a verified electoral boundary or office dataset. Current district boundaries and school-board ballot coverage need further authoritative review. |

The official [2026 calendar](https://sos.nebraska.gov/sites/default/files/doc/elections/2026/2026_Election_Calendar.pdf) and candidate certification linked by the Secretary of State were identified. Full statewide and local candidate completeness, seat/district applicability, biography/proposal attribution, school district boundaries and local results remain editorial import work. None is inferred from earlier conversations or fabricated.

A ZIP is a discovery hint, not a jurisdiction boundary. The current city/ZIP association 68305 is supported by Auburn's official municipal address; it is not a polygon, geocoder or eligibility determination.

## Maintenance

Source corrections retain the old snapshot, increment the revision and invalidate publication until independent review. Dates older than 90 days are withheld from current public election views. Source administrators must consult originals before renewing verification. The seed does not reset real verification dates on repeated execution.

Fictional demo records use a different organization and city, conspicuous labels and example.org links. These demonstrate software behavior only and must never be promoted into the official pilot dataset.
