import { useEffect, useMemo, useRef, useState } from "react";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function atMidnight(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function sameDay(left?: Date, right?: Date) {
  if (!left || !right) {
    return false;
  }

  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function endOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0);
}

function setTimeParts(base: Date, hours: number, minutes: number) {
  const next = new Date(base);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function formatDisplay(value?: Date) {
  if (!value) {
    return "";
  }

  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  const hours = `${value.getHours()}`.padStart(2, "0");
  const minutes = `${value.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function getMonthGrid(cursor: Date) {
  const first = startOfMonth(cursor);
  const last = endOfMonth(cursor);
  const startWeekday = first.getDay();
  const daysInMonth = last.getDate();
  const cells: Array<{ date: Date; currentMonth: boolean }> = [];

  for (let index = startWeekday; index > 0; index -= 1) {
    const date = new Date(first);
    date.setDate(first.getDate() - index);
    cells.push({ date, currentMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: new Date(cursor.getFullYear(), cursor.getMonth(), day), currentMonth: true });
  }

  while (cells.length % 7 !== 0) {
    const lastDate = cells[cells.length - 1]?.date ?? last;
    const date = new Date(lastDate);
    date.setDate(lastDate.getDate() + 1);
    cells.push({ date, currentMonth: false });
  }

  return cells;
}

export function DateTimeInput({
  value,
  onChange,
  className,
}: {
  value?: Date;
  onChange: (value?: Date) => void;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [cursor, setCursor] = useState<Date>(value ? new Date(value) : new Date());
  const [hours, setHours] = useState(() => `${value?.getHours() ?? 0}`.padStart(2, "0"));
  const [minutes, setMinutes] = useState(() => `${value?.getMinutes() ?? 0}`.padStart(2, "0"));

  useEffect(() => {
    if (value) {
      setCursor(new Date(value));
      setHours(`${value.getHours()}`.padStart(2, "0"));
      setMinutes(`${value.getMinutes()}`.padStart(2, "0"));
    }
  }, [value]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  const monthGrid = useMemo(() => getMonthGrid(cursor), [cursor]);
  const selectedDate = value ? new Date(value) : undefined;

  function applyDate(nextDate: Date) {
    const nextHours = Math.min(23, Math.max(0, Number.parseInt(hours || "0", 10) || 0));
    const nextMinutes = Math.min(59, Math.max(0, Number.parseInt(minutes || "0", 10) || 0));
    onChange(setTimeParts(nextDate, nextHours, nextMinutes));
  }

  function applyTime(nextHoursRaw: string, nextMinutesRaw: string) {
    setHours(nextHoursRaw);
    setMinutes(nextMinutesRaw);

    if (!selectedDate) {
      return;
    }

    const nextHoursValue = Math.min(23, Math.max(0, Number.parseInt(nextHoursRaw || "0", 10) || 0));
    const nextMinutesValue = Math.min(59, Math.max(0, Number.parseInt(nextMinutesRaw || "0", 10) || 0));
    onChange(setTimeParts(selectedDate, nextHoursValue, nextMinutesValue));
  }

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => {
          setCursor(value ? new Date(value) : new Date());
          setIsOpen((current) => !current);
        }}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-black/10 bg-w px-4 py-2 text-left text-sm t-primary transition-colors hover:border-black/20 focus:outline-none focus:ring-2 focus:ring-theme/10 dark:border-white/10 dark:hover:border-white/20"
      >
        <span className={value ? "t-primary" : "text-neutral-400 dark:text-neutral-500"}>
          {value ? formatDisplay(value) : "Select date and time"}
        </span>
        <i className={`ri-calendar-line text-base text-neutral-400 transition-transform ${isOpen ? "text-theme" : ""}`} />
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[20rem] rounded-2xl border border-black/10 bg-w p-4 shadow-lg dark:border-white/10">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-white/5 dark:hover:text-neutral-200"
              aria-label="Previous month"
            >
              <i className="ri-arrow-left-s-line" />
            </button>
            <div className="text-sm font-semibold t-primary">
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </div>
            <button
              type="button"
              onClick={() => {
                setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-white/5 dark:hover:text-neutral-200"
              aria-label="Next month"
            >
              <i className="ri-arrow-right-s-line" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((weekday) => (
              <div key={weekday} className="pb-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                {weekday}
              </div>
            ))}
            {monthGrid.map(({ date, currentMonth }) => {
              const selected = sameDay(date, selectedDate);
              const today = sameDay(date, atMidnight(new Date()));
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => {
                    applyDate(date);
                  }}
                  className={`flex h-10 items-center justify-center rounded-xl text-sm transition-colors ${
                    selected
                      ? "bg-theme text-white"
                      : currentMonth
                        ? "t-primary hover:bg-neutral-100 dark:hover:bg-white/5"
                        : "text-neutral-300 hover:bg-neutral-100 dark:text-neutral-600 dark:hover:bg-white/5"
                  } ${today && !selected ? "border border-theme/30" : ""}`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-2 border-t border-black/5 pt-4 dark:border-white/5">
            <input
              type="number"
              min={0}
              max={23}
              value={hours}
              onChange={(event) => {
                applyTime(event.target.value, minutes);
              }}
              className="w-full rounded-xl border border-black/10 bg-w px-3 py-2 text-sm t-primary outline-none transition-colors focus:border-black/20 focus:ring-2 focus:ring-theme/10 dark:border-white/10 dark:focus:border-white/20"
            />
            <span className="text-neutral-400">:</span>
            <input
              type="number"
              min={0}
              max={59}
              value={minutes}
              onChange={(event) => {
                applyTime(hours, event.target.value);
              }}
              className="w-full rounded-xl border border-black/10 bg-w px-3 py-2 text-sm t-primary outline-none transition-colors focus:border-black/20 focus:ring-2 focus:ring-theme/10 dark:border-white/10 dark:focus:border-white/20"
            />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                onChange(undefined);
                setIsOpen(false);
              }}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-white/5 dark:hover:text-neutral-200"
            >
              <i className="ri-close-line" />
              <span>Clear</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-theme px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-theme-hover active:bg-theme-active"
            >
              <span>Done</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
