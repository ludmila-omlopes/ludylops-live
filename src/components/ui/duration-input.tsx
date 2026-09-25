"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { ownerFieldClass } from "@/components/ui/owner-panel";
import { durationUnitLabels, splitDuration, toSeconds, type DurationUnit } from "@/lib/duration";

/** Edits an interval stored in seconds using seconds, minutes or hours. */
export function DurationInput({
  id,
  seconds,
  onChange,
  units = ["seconds", "minutes", "hours"],
  disabled = false,
}: {
  id: string;
  seconds: number;
  onChange: (seconds: number) => void;
  units?: DurationUnit[];
  disabled?: boolean;
}) {
  const initial = splitDuration(seconds);
  const [unit, setUnit] = useState<DurationUnit>(units.includes(initial.unit) ? initial.unit : units[0]);
  const [text, setText] = useState(String(units.includes(initial.unit) ? initial.value : seconds));

  function update(nextText: string, nextUnit: DurationUnit) {
    setText(nextText);
    setUnit(nextUnit);
    onChange(nextText.trim() === "" ? Number.NaN : toSeconds(Number(nextText.replace(",", ".")), nextUnit));
  }

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        required
        disabled={disabled}
        value={text}
        onChange={(event) => update(event.target.value, unit)}
      />
      <select
        aria-label="Unidade do intervalo"
        className={`${ownerFieldClass} w-auto`}
        disabled={disabled}
        value={unit}
        onChange={(event) => update(text, event.target.value as DurationUnit)}
      >
        {units.map((option) => (
          <option key={option} value={option}>
            {durationUnitLabels[option]}
          </option>
        ))}
      </select>
    </div>
  );
}
