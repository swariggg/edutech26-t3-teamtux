"use client";
import { Button } from "@/components/ui/Button";
import { OPEN_ADVISOR_EVENT } from "./ChatWidget";

/** Botón que abre la burbuja flotante del asesor sin salir de la página actual. */
export function OpenAdvisorButton(props: Omit<React.ComponentProps<typeof Button>, "onClick">) {
  return <Button {...props} aria-haspopup="dialog" onClick={() => window.dispatchEvent(new Event(OPEN_ADVISOR_EVENT))} />;
}
