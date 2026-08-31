import { History, Menu, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type React from "react";
import { handleMenuKeyboard } from "../shell/keyboardNav";

type CalculatorMode = "standard" | "scientific";

type CalculatorAction =
  | "clear"
  | "clear-entry"
  | "delete"
  | "equals"
  | "toggle-sign"
  | "percent"
  | "pi"
  | "sqrt"
  | "square"
  | "reciprocal"
  | "sin"
  | "cos"
  | "tan"
  | "log"
  | "ln";

type CalculatorButton = {
  action?: CalculatorAction;
  className?: string;
  label: string;
  value?: string;
};

const calculatorStandardButtons: CalculatorButton[] = [
  { action: "percent", className: "is-utility", label: "%" },
  { action: "clear-entry", className: "is-utility", label: "CE" },
  { action: "clear", className: "is-utility", label: "C" },
  { action: "delete", className: "is-utility", label: "⌫" },
  { action: "reciprocal", className: "is-utility", label: "1/x" },
  { action: "square", className: "is-utility", label: "x²" },
  { action: "sqrt", className: "is-utility", label: "²√x" },
  { label: "÷", value: "/" },
  { label: "7", value: "7" },
  { label: "8", value: "8" },
  { label: "9", value: "9" },
  { label: "×", value: "*" },
  { label: "4", value: "4" },
  { label: "5", value: "5" },
  { label: "6", value: "6" },
  { label: "-", value: "-" },
  { label: "1", value: "1" },
  { label: "2", value: "2" },
  { label: "3", value: "3" },
  { label: "+", value: "+" },
  { action: "toggle-sign", className: "is-utility", label: "±" },
  { label: "0", value: "0" },
  { label: ".", value: "." },
  { action: "equals", className: "is-equals", label: "=" },
];

const calculatorScientificButtons: CalculatorButton[] = [
  { action: "sin", label: "sin" },
  { action: "cos", label: "cos" },
  { action: "tan", label: "tan" },
  { action: "sqrt", label: "√" },
  { action: "square", label: "x²" },
  { action: "reciprocal", label: "1/x" },
  { action: "log", label: "log" },
  { action: "ln", label: "ln" },
  { action: "pi", label: "π" },
];

export default function CalculatorApp() {
  const [display, setDisplay] = useState("0");
  const [mode, setMode] = useState<CalculatorMode>("standard");
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [calculationHistory, setCalculationHistory] = useState<
    Array<{ expression: string; result: string }>
  >([]);
  const [memory, setMemory] = useState<number | null>(null);
  const calculatorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    calculatorRef.current?.focus();
  }, []);

  const appendValue = (value: string) => {
    setDisplay((current) => appendCalculatorValue(current, value));
  };

  const usesPrecedence = mode === "scientific";

  const applyUnary = (operation: (value: number) => number) => {
    setDisplay((current) => applyCalculatorUnary(current, operation, usesPrecedence));
  };

  const runAction = (action: CalculatorAction) => {
    if (action === "clear" || action === "clear-entry") {
      setDisplay("0");
      return;
    }

    if (action === "delete") {
      // Windows clears the error rather than editing its text: backspacing
      // "Error" used to leave "Erro", then "Err", as if it were an entry.
      setDisplay((current) =>
        isCalculatorError(current) || current.length <= 1 ? "0" : current.slice(0, -1),
      );
      return;
    }

    if (action === "equals") {
      setDisplay((current) => {
        const result = evaluateExpression(current, usesPrecedence);
        const formatted = formatCalculatorResult(result);
        setCalculationHistory((historyItems) =>
          [{ expression: current, result: formatted }, ...historyItems].slice(0, 20),
        );
        return formatted;
      });
      return;
    }

    if (action === "toggle-sign") {
      setDisplay((current) => toggleCalculatorSign(current));
      return;
    }

    if (action === "percent") {
      setDisplay((current) => applyCalculatorPercent(current, usesPrecedence));
      return;
    }

    if (action === "pi") {
      setDisplay((current) => insertCalculatorPi(current));
      return;
    }

    if (action === "sqrt") applyUnary(Math.sqrt);
    if (action === "square") applyUnary((value) => value * value);
    if (action === "reciprocal") applyUnary((value) => 1 / value);
    if (action === "sin") applyUnary((value) => Math.sin(degreesToRadians(value)));
    if (action === "cos") applyUnary((value) => Math.cos(degreesToRadians(value)));
    if (action === "tan") applyUnary((value) => Math.tan(degreesToRadians(value)));
    if (action === "log") applyUnary(Math.log10);
    if (action === "ln") applyUnary(Math.log);
  };

  const getCurrentCalculatorValue = () => {
    const value = evaluateExpression(display, usesPrecedence);
    return Number.isFinite(value) ? value : 0;
  };

  const runMemoryAction = (action: "clear" | "recall" | "add" | "subtract" | "store") => {
    if (action === "clear") {
      setMemory(null);
      return;
    }
    if (action === "recall") {
      if (memory !== null) setDisplay(formatCalculatorResult(memory));
      return;
    }
    const value = getCurrentCalculatorValue();
    if (action === "store") setMemory(value);
    if (action === "add") setMemory((current) => (current ?? 0) + value);
    if (action === "subtract") setMemory((current) => (current ?? 0) - value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const key = event.key;
    const handled = () => {
      event.preventDefault();
      event.stopPropagation();
    };

    if (/^\d$/.test(key) || ["+", "-", "*", "/", "."].includes(key)) {
      handled();
      appendValue(key);
      return;
    }

    if (key === "Enter" || key === "=") {
      // Enter on a focused button presses that button. Claiming it here left
      // keyboard users unable to activate any key on the pad.
      if (key === "Enter" && (event.target as HTMLElement).closest("button")) return;
      handled();
      runAction("equals");
      return;
    }

    if (key === "Backspace") {
      handled();
      runAction("delete");
      return;
    }

    if (key === "Delete" || key === "Escape" || key.toLowerCase() === "c") {
      handled();
      runAction("clear");
      return;
    }

    if (key === "%") {
      handled();
      runAction("percent");
      return;
    }

    if (key.toLowerCase() === "p") {
      handled();
      runAction("pi");
    }
  };

  const renderCalculatorButton = (button: CalculatorButton) => (
    <button
      className={button.className ?? ""}
      key={button.label}
      onClick={() =>
        button.action ? runAction(button.action) : appendValue(button.value ?? "")
      }
      type="button"
    >
      {button.label}
    </button>
  );

  return (
    <div
      className={`calculator-app calc-mode-${mode}`}
      onContextMenu={(event) => {
        // Chrome's own menu was opening over the fake desktop; every other app
        // here keeps the right click for the shell.
        event.preventDefault();
      }}
      onKeyDown={handleKeyDown}
      onPointerDown={() => calculatorRef.current?.focus()}
      ref={calculatorRef}
      tabIndex={0}
    >
      <div className="calc-header">
        <button
          aria-expanded={modeMenuOpen}
          aria-label="탐색 열기"
          onClick={() => {
            setModeMenuOpen((current) => !current);
            setHistoryOpen(false);
          }}
          title="탐색 열기"
          type="button"
        >
          <Menu aria-hidden="true" size={18} />
        </button>
        <strong>{mode === "standard" ? "표준" : "공학용"}</strong>
        <button
          aria-expanded={historyOpen}
          aria-label="기록"
          onClick={() => {
            setHistoryOpen((current) => !current);
            setModeMenuOpen(false);
          }}
          title="기록"
          type="button"
        >
          <History aria-hidden="true" size={18} />
        </button>
      </div>
      {modeMenuOpen && (
        <div
          className="calc-mode-menu"
          role="menu"
          onKeyDown={(event) => handleMenuKeyboard(event, event.currentTarget)}
        >
          {(["standard", "scientific"] as CalculatorMode[]).map((option) => (
            <button
              className={mode === option ? "is-selected" : ""}
              key={option}
              onClick={() => {
                setMode(option);
                setModeMenuOpen(false);
              }}
              role="menuitem"
              type="button"
            >
              {option === "standard" ? "표준" : "공학용"}
            </button>
          ))}
        </div>
      )}
      {historyOpen && (
        <aside className="calc-history-panel">
          <header>
            <strong>기록</strong>
            <button
              aria-label="기록 지우기"
              disabled={calculationHistory.length === 0}
              onClick={() => setCalculationHistory([])}
              title="기록 지우기"
              type="button"
            >
              <Trash2 aria-hidden="true" size={16} />
            </button>
          </header>
          {calculationHistory.length > 0 ? (
            <div>
              {calculationHistory.map((entry, index) => (
                <button
                  key={`${entry.expression}-${index}`}
                  onClick={() => {
                    setDisplay(entry.result);
                    setHistoryOpen(false);
                  }}
                  type="button"
                >
                  <small>{entry.expression} =</small>
                  <strong>{entry.result}</strong>
                </button>
              ))}
            </div>
          ) : (
            <p>아직 기록이 없습니다.</p>
          )}
        </aside>
      )}
      <output aria-label="계산기 표시창">{display}</output>
      <div className="calc-memory-row" aria-label="메모리">
        <button
          disabled={memory === null}
          onClick={() => runMemoryAction("clear")}
          type="button"
        >
          MC
        </button>
        <button
          disabled={memory === null}
          onClick={() => runMemoryAction("recall")}
          type="button"
        >
          MR
        </button>
        <button onClick={() => runMemoryAction("add")} type="button">
          M+
        </button>
        <button onClick={() => runMemoryAction("subtract")} type="button">
          M−
        </button>
        <button onClick={() => runMemoryAction("store")} type="button">
          MS
        </button>
      </div>
      {mode === "scientific" && (
        <div className="calc-grid calc-scientific-grid" aria-label="공학용 함수">
          {calculatorScientificButtons.map(renderCalculatorButton)}
        </div>
      )}
      <div className="calc-grid calc-standard-grid" aria-label="계산기 버튼">
        {calculatorStandardButtons.map(renderCalculatorButton)}
      </div>
    </div>
  );
}

/*
 * Windows' standard calculator runs left to right — `2+3×4` is 20, because ×4
 * applies to the 5 already on the display — and only the scientific one applies
 * precedence, where the same keys give 14. This gave 14 in both modes, so the
 * standard mode answered a question the user had not asked.
 */
function evaluateExpression(expression: string, precedence = true) {
  const tokens = tokenizeExpression(expression);
  if (tokens.length === 0) return Number.NaN;

  if (!precedence) {
    let running = Number(tokens[0]);
    for (let index = 1; index < tokens.length; index += 2) {
      const operator = tokens[index];
      const next = Number(tokens[index + 1]);
      if (operator === "+") running += next;
      else if (operator === "-") running -= next;
      else if (operator === "*") running *= next;
      else if (operator === "/") running /= next;
    }
    return running;
  }

  const firstPass: Array<number | string> = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "*" || token === "/") {
      const previous = Number(firstPass.pop());
      const next = Number(tokens[index + 1]);
      firstPass.push(token === "*" ? previous * next : previous / next);
      index += 1;
    } else {
      firstPass.push(token);
    }
  }

  let total = Number(firstPass[0]);
  for (let index = 1; index < firstPass.length; index += 2) {
    const operator = firstPass[index];
    const next = Number(firstPass[index + 1]);
    total = operator === "+" ? total + next : total - next;
  }

  return total;
}

function tokenizeExpression(expression: string): string[] {
  if (!/^[\d+\-*/. ]+$/.test(expression)) return [];
  const tokens: string[] = [];
  let current = "";

  for (const char of expression.replace(/\s/g, "")) {
    const previousToken = tokens[tokens.length - 1];
    /*
     * A minus is a sign only with no number in progress. Checking `tokens`
     * alone missed the digits still sitting in `current`, so "200-10" became
     * the single token "200-10", and Number() of that is NaN: every
     * subtraction in the calculator answered Error.
     */
    const unaryMinus =
      char === "-" &&
      current === "" &&
      (tokens.length === 0 || ["+", "-", "*", "/"].includes(previousToken));
    if (/\d|\./.test(char) || unaryMinus) {
      current += char;
      continue;
    }
    if (current) {
      tokens.push(current);
      current = "";
    }
    tokens.push(char);
  }
  if (current) tokens.push(current);

  return tokens;
}

function appendCalculatorValue(current: string, value: string) {
  const operators = ["+", "-", "*", "/"];

  if (isCalculatorError(current)) {
    return operators.includes(value) ? `0${value}` : value === "." ? "0." : value;
  }

  if (operators.includes(value)) {
    const last = current[current.length - 1];
    if (current === "0" && value === "-") return "-";
    if (last && operators.includes(last)) {
      if (value === "-" && last !== "-") return `${current}${value}`;
      return `${current.slice(0, -1)}${value}`;
    }
    return `${current}${value}`;
  }

  if (value === ".") {
    const last = current[current.length - 1];
    if (last && operators.includes(last)) return `${current}0.`;
    if (getCurrentCalculatorFragment(current).includes(".")) return current;
    return current === "0" ? "0." : `${current}.`;
  }

  if (/^\d$/.test(value)) {
    if (current === "0") return value;
    return `${current}${value}`;
  }

  return current;
}

/**
 * Windows reads % against the pending operand, not the whole expression:
 * `50 + 10 %` is 10% *of 50*, so the entry becomes 5 and = gives 55. Dividing
 * the evaluated expression by 100 instead turned that into 0.6, and made
 * `200 - 10 %` an outright Error — the single most common thing anyone asks a
 * calculator for. With × and ÷ the percentage is the plain fraction, and a
 * percentage of nothing is 0.
 */
function applyCalculatorPercent(expression: string, precedence: boolean) {
  if (isCalculatorError(expression)) return expression;

  const fragment = getCurrentCalculatorFragment(expression);
  const entry = Number(fragment);
  if (!fragment || !Number.isFinite(entry)) return expression;

  const head = expression.slice(0, expression.length - fragment.length);
  const operator = head[head.length - 1];
  if (!operator) return "0";

  const left = evaluateExpression(head.slice(0, -1), precedence);
  if (!Number.isFinite(left)) return expression;

  const share = operator === "+" || operator === "-" ? (left * entry) / 100 : entry / 100;
  return `${head}${formatCalculatorResult(share)}`;
}

/*
 * Windows applies 1/x, x² and √ to the entry, not to the whole expression:
 * `2 + 3` then `1/x` shows `2 + 0.333…`, keeping the pending `2 +`. Evaluating
 * everything first answered 0.2 and silently dropped the operator — and it
 * disagreed with %, which already worked on the pending operand.
 */
function applyCalculatorUnary(
  expression: string,
  operation: (value: number) => number,
  precedence: boolean,
) {
  if (isCalculatorError(expression)) return expression;

  const fragment = getCurrentCalculatorFragment(expression);
  const entry = fragment ? Number(fragment) : evaluateExpression(expression, precedence);
  if (!Number.isFinite(entry)) return formatCalculatorResult(entry);

  const head = expression.slice(0, expression.length - fragment.length);
  const result = formatCalculatorResult(operation(entry));
  // A fault in the middle of an expression replaces the display, as it does on
  // Windows — "2+0으로 나눌 수 없습니다" would be nonsense.
  if (!/^-?[\d.]/.test(result)) return result;
  return `${head}${result}`;
}

function toggleCalculatorSign(expression: string) {
  // Negating nothing is still nothing on Windows. Returning "-" left the
  // display in a state where the next = answered Error.
  if (isCalculatorError(expression) || expression === "0") return "0";
  const fragment = getCurrentCalculatorFragment(expression);
  if (!fragment || fragment === "-") return expression;

  const start = expression.length - fragment.length;
  const nextFragment = fragment.startsWith("-") ? fragment.slice(1) : `-${fragment}`;
  return `${expression.slice(0, start)}${nextFragment}`;
}

function insertCalculatorPi(expression: string) {
  const pi = trimNumber(Math.PI);
  if (isCalculatorError(expression) || expression === "0") return pi;
  const last = expression[expression.length - 1];
  if (!last || ["+", "-", "*", "/"].includes(last)) return `${expression}${pi}`;
  return `${expression}*${pi}`;
}

function getCurrentCalculatorFragment(expression: string) {
  let start = expression.length;

  while (start > 0) {
    const char = expression[start - 1];
    if (char === "+" || char === "*" || char === "/") break;
    if (char === "-") {
      const before = expression[start - 2];
      if (start - 1 === 0 || ["+", "-", "*", "/"].includes(before)) {
        start -= 1;
        continue;
      }
      break;
    }
    start -= 1;
  }

  return expression.slice(start);
}

/*
 * Windows names the fault instead of printing one word for all of them: the
 * display used to read "Error" whether the user divided by zero, asked for the
 * root of a negative number, or typed something the parser could not read.
 */
const CALCULATOR_DIVIDE_BY_ZERO = "0으로 나눌 수 없습니다";
const CALCULATOR_INVALID_INPUT = "잘못된 입력입니다";

export function isCalculatorError(display: string) {
  return display === CALCULATOR_DIVIDE_BY_ZERO || display === CALCULATOR_INVALID_INPUT;
}

function formatCalculatorResult(value: number) {
  if (Number.isFinite(value)) return trimNumber(value);
  return Number.isNaN(value) ? CALCULATOR_INVALID_INPUT : CALCULATOR_DIVIDE_BY_ZERO;
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function trimNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(8)));
}
