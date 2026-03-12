/**
 * JSON-LD structured data enjektörü.
 * <head> içine <script type="application/ld+json"> ekler.
 */

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schemas: Record<string, any>[];
}

export function SchemaMarkup({ schemas }: Props) {
  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}
