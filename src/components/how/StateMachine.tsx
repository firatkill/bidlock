import { howCopy as copy } from "@/domain/copy";
// svg is read only from the committed artifact by the server page, never user input.
export function StateMachine({ svg }: { svg: string }) {
  return (
    <section id="state-machine" className="how-section">
      <h2>{copy.lifecycle}</h2>
      <div
        className="how-scroll"
        role="region"
        aria-label={copy.lifecycle}
        tabIndex={0}
      >
        <div
          className="how-diagram"
          role="img"
          aria-label={copy.lifecycle}
          // PRD §9.4 explicitly permits only this committed SVG.
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
      <div
        className="how-scroll"
        role="region"
        aria-label={copy.transitionHeaders[3]}
        tabIndex={0}
      >
        <table className="how-table min-w-240">
          <thead>
            <tr>
              {copy.transitionHeaders.map((label) => (
                <th key={label} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {copy.transitions.map((row) => (
              <tr key={row[0]}>
                {row.map((cell, index) =>
                  index === 0 ? (
                    <th scope="row" key={index}>
                      {cell}
                    </th>
                  ) : (
                    <td key={index}>{cell}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
