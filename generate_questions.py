import random

def generate_question(index):
    types = [1, 2, 3, 4]
    t = random.choice(types)
    if t == 1: # Multiplication (single)
        a = random.randint(2, 12)
        b = random.randint(2, 12)
        q = f"Calculate the value of the expression: $ {a} \\times {b} $"
        ans = a * b
        opts = [ans, ans + random.randint(1, 5), ans - random.randint(1, 5), ans + random.randint(6, 10)]
        opts = list(set(opts))
        while len(opts) < 4:
            opts.append(ans + random.randint(11, 20))
            opts = list(set(opts))
        random.shuffle(opts)
        correct = [str(opts.index(ans))]
        expl = f"Ta có phép nhân $ {a} \\times {b} = {ans} $."
        return "single", q, opts, correct, expl
    elif t == 2: # Derivative (single)
        n = random.randint(2, 5)
        q = f"What is the derivative of the function $ f(x) = x^{n} $ with respect to $ x $?"
        ans = f"{n}x^{{{n-1}}}" if n > 2 else f"{n}x"
        opts = [f"{n}x^{{{n-1}}}" if n > 2 else f"{n}x", f"{n+1}x^{{{n}}}", f"x^{{{n-1}}}", f"{n}x^{{{n}}}"]
        opts = [f"$ {o} $" for o in opts]
        ans_str = f"$ {ans} $"
        random.shuffle(opts)
        correct = [str(opts.index(ans_str))]
        expl = f"Áp dụng công thức đạo hàm cơ bản $ (x^n)' = n x^{{n-1}} $, ta có đạo hàm của $ x^{n} $ là $ {ans} $."
        return "single", q, opts, correct, expl
    elif t == 3: # Multiples (multiple)
        a = random.randint(2, 5)
        q = f"Which of the following numbers are multiples of $ {a} $?"
        ans1 = a * random.randint(2, 5)
        ans2 = a * random.randint(6, 9)
        wrong1 = ans1 + 1
        wrong2 = ans2 - 1
        opts = [ans1, ans2, wrong1, wrong2]
        random.shuffle(opts)
        correct = [str(i) for i, x in enumerate(opts) if x % a == 0]
        opts = [f"$ {o} $" for o in opts]
        expl = f"Các số chia hết cho $ {a} $ được gọi là bội số của $ {a} $."
        return "multiple", q, opts, correct, expl
    else: # Roots (multiple)
        a = random.randint(1, 5)
        q = f"What are the roots of the equation $ x^2 - {a**2} = 0 $?"
        ans1 = a
        ans2 = -a
        wrong1 = a + 1
        wrong2 = -a - 1
        opts = [ans1, ans2, wrong1, wrong2]
        random.shuffle(opts)
        correct = [str(i) for i, x in enumerate(opts) if x == a or x == -a]
        opts = [f"$ {o} $" for o in opts]
        expl = f"Ta có phương trình $ x^2 - {a**2} = 0 \\iff x^2 = {a**2} \\iff x = \\pm {a} $. Vậy phương trình có các nghiệm là $ {a} $ và $ -{a} $."
        return "multiple", q, opts, correct, expl

questions = []
for i in range(1, 51):
    q_type, q, opts, correct, expl = generate_question(i)
    questions.append({
        "Q": q,
        "T": q_type,
        "O": [str(o) for o in opts],
        "A": ",".join(correct),
        "E": expl
    })

with open("questions.txt", "w", encoding="utf-8") as f:
    for q in questions:
        f.write(f"Q: {q['Q']}\n")
        f.write(f"T: {q['T']}\n")
        for o in q["O"]:
            f.write(f"O: {o}\n")
        f.write(f"A: {q['A']}\n")
        f.write(f"E: {q['E']}\n\n")

print("Generated 50 questions in questions.txt")
