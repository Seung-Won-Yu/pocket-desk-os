// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import CalculatorApp from "./CalculatorApp";

afterEach(cleanup);

function renderCalculator() {
  const user = userEvent.setup();
  render(<CalculatorApp />);
  const display = () => screen.getByLabelText("계산기 표시창").textContent;
  const press = async (...labels: string[]) => {
    for (const label of labels) {
      const [match] = screen
        .getAllByRole("button")
        .filter((node) => node.textContent === label);
      await user.click(match);
    }
  };
  return { display, press, user };
}

describe("계산기 산술", () => {
  // Every subtraction answered Error: the left operand was still in the digit
  // buffer, so the minus was read as a sign and glued onto it.
  it.each([
    [["5", "-", "3", "="], "2"],
    [["2", "0", "0", "-", "1", "0", "="], "190"],
    [["2", "+", "3", "-", "1", "="], "4"],
    [["8", "÷", "2", "-", "1", "="], "3"],
    [["2", "+", "3", "="], "5"],
    [["6", "×", "7", "="], "42"],
  ])("%s 를 계산한다", async (keys, expected) => {
    const { display, press } = renderCalculator();
    await press(...keys);
    expect(display()).toBe(expected);
  });

  it("음수를 입력받는다", async () => {
    const { display, press } = renderCalculator();
    await press("2", "×", "-", "3", "=");
    expect(display()).toBe("-6");
  });
});

describe("계산기 백분율", () => {
  // Windows reads % against the pending operand, not the whole expression.
  it("더하기의 백분율은 왼쪽 값 기준이다", async () => {
    const { display, press } = renderCalculator();
    await press("5", "0", "+", "1", "0", "%");
    expect(display()).toBe("50+5");
    await press("=");
    expect(display()).toBe("55");
  });

  it("빼기의 백분율도 왼쪽 값 기준이다", async () => {
    const { display, press } = renderCalculator();
    await press("2", "0", "0", "-", "1", "0", "%", "=");
    expect(display()).toBe("180");
  });

  it("곱하기의 백분율은 분수 그대로다", async () => {
    const { display, press } = renderCalculator();
    await press("2", "0", "0", "×", "1", "0", "%", "=");
    expect(display()).toBe("20");
  });

  it("연산자 없이 누른 백분율은 0이다", async () => {
    const { display, press } = renderCalculator();
    await press("5", "0", "%");
    expect(display()).toBe("0");
  });
});

describe("계산기 상태", () => {
  it("초기 상태에서 부호를 바꿔도 고장 나지 않는다", async () => {
    const { display, press } = renderCalculator();
    await press("±");
    expect(display()).toBe("0");
    await press("=");
    expect(display()).toBe("0");
  });

  it("오류 상태에서 백스페이스는 오류를 지운다", async () => {
    const { display, press } = renderCalculator();
    // 1/x of 0 is the shortest way to a genuine error state.
    await press("0", "1/x");
    expect(display()).toBe("Error");
    await press("⌫");
    expect(display()).toBe("0");
  });

  it("버튼에 포커스한 채 Enter를 누르면 그 버튼이 눌린다", async () => {
    const { display, user } = renderCalculator();
    const sevenKey = screen.getAllByRole("button").find((node) => node.textContent === "7");
    sevenKey?.focus();
    await user.keyboard("{Enter}");
    // Claiming Enter for = left keyboard users unable to press any key.
    expect(display()).toBe("7");
  });
});
