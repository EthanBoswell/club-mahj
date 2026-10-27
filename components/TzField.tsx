"use client";
import { useEffect, useState } from "react";

// Sends the browser's UTC offset so the server stores the right moment in time.
export default function TzField() {
  const [offset, setOffset] = useState(0);
  useEffect(() => setOffset(new Date().getTimezoneOffset()), []);
  return <input type="hidden" name="tz_offset" value={offset} />;
}
