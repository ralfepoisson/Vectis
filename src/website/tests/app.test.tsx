import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "../src/App";

describe("Vectis marketing website", () => {
  it("renders the product proposition and MVP call to action", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: /from visual signals to confident action/i
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /explore the mvp/i
      })
    ).toBeInTheDocument();
  });
});
