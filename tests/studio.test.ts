import { describe, it, expect } from "vitest";
import { parseLines, rowsToLines, looksLikeTable, guessType } from "@/lib/studio/parse";

const L = (...t: string[]) => t.map((text) => ({ text }));

describe("form studio — PDF-style text", () => {
  const d = parseLines([
    { text: "Demo Hotel One", size: 14 },
    { text: "GUEST LATE CHECK-OUT REQUEST FORM", size: 16 },
    { text: "Form No: FO-F-007 Rev 3", size: 9 },
    { text: "Please complete this form and hand it to the front office at least 24 hours before departure.", size: 10 },
    { text: "GUEST DETAILS", size: 11 },
    { text: "Guest Name*: ______________________  Room No: ________", size: 10 },
    { text: "Email: ____________________ Mobile: _______________", size: 10 },
    { text: "Departure Date: ____ / ____ / ______", size: 10 },
    { text: "Requested check-out time:", size: 10 },
    { text: "☐ 2 pm ☐ 4 pm ☐ 6 pm", size: 10 },
    { text: "Breakfast included? ☐ Yes ☐ No", size: 10 },
    { text: "Reason for request: ..........................................", size: 10 },
    { text: "Number of nights: _____", size: 10 },
    { text: "Guest Signature: _______________", size: 10 },
    { text: "Checked by (Duty Manager): ____________  Signature: ________ Date: ______", size: 10 },
    { text: "Approved by (Front Office Manager): ________________", size: 10 },
    { text: "Page 1 of 1", size: 8 },
  ]);
  const byLabel = Object.fromEntries(d.fields.map((f) => [f.label, f]));
  it("finds title, form code and instructions", () => {
    expect(d.title).toBe("Guest Late Check-Out Request Form");
    expect(d.formCode).toBe("FO-F-007 Rev 3");
    expect(d.description).toMatch(/front office/);
  });
  it("finds sections and typed fields", () => {
    expect(d.fields[0]).toMatchObject({ type: "heading", label: "Guest Details" });
    expect(byLabel["Guest Name"]).toMatchObject({ type: "text", required: true });
    expect(byLabel["Room No"].type).toBe("text");
    expect(byLabel["Email"].type).toBe("email");
    expect(byLabel["Mobile"].type).toBe("phone");
    expect(byLabel["Departure Date"].type).toBe("date");
    expect(byLabel["Reason for request"].type).toBe("textarea");
    expect(byLabel["Number of nights"].type).toBe("number");
    expect(byLabel["Guest Signature"].type).toBe("signature");
  });
  it("turns check boxes into choices", () => {
    expect(byLabel["Requested check-out time"]).toMatchObject({ type: "checkbox", options: ["2 pm", "4 pm", "6 pm"] });
    expect(parseLines(L("X form", "Priority: ☐ Low ☐ High")).fields[0]).toMatchObject({ type: "radio", options: ["Low", "High"] });
    expect(byLabel["Breakfast included?"]).toMatchObject({ type: "radio", options: ["Yes", "No"] });
  });
  it("turns the sign-off block into approval levels, not fields", () => {
    expect(d.steps).toEqual(["Duty Manager check", "Front Office Manager approval"]);
    expect(d.fields.some((f) => /checked|approved/i.test(f.label))).toBe(false);
  });
});

describe("form studio — Excel", () => {
  it("detects a data table vs a laid-out form", () => {
    expect(looksLikeTable([["Name", "Room", "Date"], ["A", "1", "x"], ["B", "2", "y"], ["C", "3", "z"]])).toBe(true);
    expect(looksLikeTable([["PURCHASE REQUISITION"], ["Department:", "", "Date:", ""], ["Item", "Qty"]])).toBe(false);
  });
  it("reads a laid-out sheet: labels in cells, blanks after them", () => {
    const d = parseLines(rowsToLines([
      ["PURCHASE REQUISITION", "", "", ""],
      ["Department:", "", "Date required:", ""],
      ["Supplier name:", "ABC Traders", "", ""],
      ["Estimated amount (LKR)", "", "Quotation attached", "☐ Yes ☐ No"],
      ["Justification:", "", "", ""],
      ["Recommended by HOD", "", "Approved by GM", ""],
    ]), "excel-form");
    expect(d.title).toBe("Purchase Requisition");
    const labels = d.fields.map((f) => `${f.label}:${f.type}`);
    expect(labels).toEqual(expect.arrayContaining(["Department:text", "Date required:date", "Supplier name:text", "Estimated amount (LKR):number", "Justification:textarea"]));
    expect(labels).not.toContain("ABC Traders:text");
    expect(d.steps).toEqual(["HOD recommendation", "GM approval"]);
  });
});

it("guesses types from labels", () => {
  expect(guessType("Copy of NIC / passport")).toBe("file");
  expect(guessType("Total cost (USD)")).toBe("number");
  expect(guessType("Check-in")).toBe("date");
  expect(guessType("Department")).toBe("text");
  expect(parseLines(L("Leave Application", "Name:", "Leave type ☐ Annual ☐ Sick ☐ Casual")).fields.map((f) => f.type)).toEqual(["text", "radio"]);
});

it("keeps the requester's own 'Requested by' field and ignores header text above the title", () => {
  const d = parseLines([
    { text: "Demo Hotel One", size: 13 }, { text: "MAINTENANCE WORK REQUEST FORM", size: 20 },
    { text: "Requested by*: ________  Department: ________", size: 12 }, { text: "Approved by (GM): ______", size: 12 },
  ]);
  expect(d.fields.map((f) => f.label)).toEqual(["Requested by", "Department"]);
  expect(d.fields[0].required).toBe(true);
  expect(d.steps).toEqual(["GM approval"]);
});
