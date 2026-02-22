import Link from "next/link";

interface DutyDateTabsProps {
  basePath: string;
  selectedDate: string;
  availableDates: string[];
}

export function DutyDateTabs({ basePath, selectedDate, availableDates }: DutyDateTabsProps) {
  const dates = [...new Set(availableDates)]
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item))
    .sort();

  if (!dates.length) {
    return null;
  }

  return (
    <section className="panel duty-date-tabs">
      <h3>Tarih Sekmeleri</h3>
      <div className="duty-date-tab-list">
        {dates.map((date) => {
          const href = {
            pathname: basePath,
            query: { date }
          };
          const isActive = date === selectedDate;
          return (
            <Link
              key={date}
              href={href}
              className={isActive ? "pill duty-date-tab active" : "pill duty-date-tab"}
            >
              {formatDateLabel(date)}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function formatDateLabel(dateIso: string): string {
  const [year, month, day] = dateIso.split("-");
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const weekday = date.toLocaleDateString("tr-TR", { weekday: "short" });
  return `${day}.${month}.${year} ${weekday}`;
}
