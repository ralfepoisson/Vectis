import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "../src/App";

describe("Vectis webapp", () => {
  it("renders the control center shell and sample event feed", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: /control center/i
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/structured observations/i)).toBeInTheDocument();
    expect(screen.getByText(/safety_violation/i)).toBeInTheDocument();
  });
});
