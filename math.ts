// We're only going to deal with the integers for this since it greatly
// simplifies many things.

// Note on syntax. We use assigment as unit testing
// e.g.
type ShouldBeTrue = true;
const testShouldBeTrue: ShouldBeTrue = true;
// if instead we wrote
// const thisShouldBeTrue: ShouldBeTrue = false;
// we'd get a type error. This helps me change the implementations
// and get instant feedback if I broke anything.

// =========== EQUALITY ================
// Use a generic type constraint to check for equal types
// extends attempts to assign the type on the left to the type on the right
// used with conditionals, we can get branching by failing or succeeding to
// do that assignment.

// If type A is a subtype of B and B is a subtype of A, they are "equal"
type Eq<A extends number, B extends number> = A extends B
  ? B extends A
    ? true
    : false
  : false;

const testEqResTrue: Eq<1, 1> = true;
const testEqResFalse: Eq<1, 2> = false;

// Works since we're using type literals
// Doesn't give the intended results for runtime types
let a = 1;
let b = 2;
const testEqTrap: Eq<typeof a, typeof b> = true;

// =========== ADDITION ================
// Needs a few more concepts

// Indexed access types: T['length'] => like obj key but in type-land
type indexedObj = {
  someKey: string;
  otherKey: number;
  // catch all for extension
  [key: string]: string | number;
};

type indacc1 = indexedObj["someKey"];
type indacc2 = indexedObj["otherKey"];
type indacc3 = indexedObj["something else entirely"];

// Variadic tuples: spread like you know and love basically (but tuples not vec)
// Going to skip over a motivating example since it's a bit contrived and I think
// people understand the usefulness of spread operator and such.

// Recursive conditional types: just allows types to reference themselves
// during their construction. Also a bit contrived to create an example.

// Turn a type literal into a tuple with length equal to the literal
// 2 -> [any, any] and further [any, any]['length'] -> 2
type Digits<N extends number, T extends any[] = []> = T["length"] extends N
  ? T
  : Digits<N, [any, ...T]>;

// Create tuples of length A and B and concatenate them, then take the length
// Called unchecked because it doesn't handle negatives, we'll come back to that
// below subtraction
type AddUnchecked<A extends number, B extends number> = [
  ...Digits<A>,
  ...Digits<B>,
]["length"];

const testAddRes: AddUnchecked<19, 37> = 56;

// ============ SUBTRACTION ===============
// Uses another concept
// Generic Conditional Type Inference: used to pull parts of a type out of
// another type in generic conditionals. Think of it as a "variable" for part
// of the type.
// In this example, the type of the item is "pulled out" as `U` during the type
// construction and then either returned or not
type GetItemType<T> = T extends (infer U)[] ? U : T;

let arr1 = [1, 2, 3];
type items1 = GetItemType<typeof arr1>;

let arr2 = [1, "string", { key: "value" }];
type items2 = GetItemType<typeof arr2>;

let notarr = { concrete: 123 };
type notitem = GetItemType<typeof notarr>;

// Construct a large tuple A, attempt to assign to a new type comprised of:
// 1. a tuple of length B
// 2. an inferred length tuple (U) which signifies the difference between the
//    length of A and B
// only works for A >= B so we need to generalize via GT/LT
type SubUnchecked<A extends number, B extends number> =
  Digits<A> extends [...Digits<B>, ...infer U] ? U["length"] : never;

const testSubUncheckedResFine: SubUnchecked<100, 1> = 99;
type SubUncheckedProblem = SubUnchecked<1, 2>;

// ============ GENERALIZATION ===============
// ======= WARNING: HERE BE DRAGONS ==========
// We're going to generalize addition and subtraction to work with all
// integers, not just positive ordered ones.

// Check if A >= B by checking if the tuple can be assigned to a Digits<B> length
// tuple plus zero-to-many more elements
type GTE<A extends number, B extends number> =
  Digits<A> extends [...Digits<B>, ...any[]] ? true : false;

const testGTEResLess: GTE<1, 0> = true;
const testGTEResEq: GTE<1, 1> = true;
const testGTEResFalse: GTE<1, 2> = false;

// Construct negative numbers via generic template literal types
// These literals will be strings so we need to re-parse as int
type ParseInt<A> = A extends `${infer N extends number}` ? N : never;
const testParseRes: ParseInt<"1"> = 1;

type Negate<A extends number> = A extends 0
  ? 0
  : `${A}` extends `-${infer N extends number}`
    ? N
    : ParseInt<`-${A}`>;
const testNegatePos: Negate<1> = -1;
const testNegateZero: Negate<0> = 0;
const testNegateNeg: Negate<-1> = 1;

type IsNegative<A extends number> = `${A}` extends `-${number}` ? true : false;
const testIsNegResTrue: IsNegative<-1> = true;
const testIsNegativeZero: IsNegative<0> = false;
const testIsNegResFalse: IsNegative<1> = false;

// Finally we have a positive and negative subtraction and addition
// We need to handle all the cases of { A, B } where elements can
// be positive or negative, and their relation (GTE) to each other
type Sub<A extends number, B extends number> =
  IsNegative<A> extends true
    ? IsNegative<B> extends true
      ? GTE<Negate<A>, Negate<B>> extends true
        ? Negate<SubUnchecked<Negate<A>, Negate<B>>>
        : SubUnchecked<Negate<B>, Negate<A>>
      : // AddUnchecked doesn't necessarily return "extends numbers" TODO: can we rid of this?
        AddUnchecked<Negate<A>, B> extends number
        ? Negate<AddUnchecked<Negate<A>, B>>
        : never
    : IsNegative<B> extends true
      ? AddUnchecked<A, Negate<B>>
      : GTE<A, B> extends true
        ? SubUnchecked<A, B>
        : Negate<SubUnchecked<B, A>>;

const testSubPosPosLT: Sub<1, 10> = -9;
const testSubPosPosGT: Sub<10, 1> = 9;
const testSubPosPosEq: Sub<10, 10> = 0;

// Pos, Neg can only be GT
const testSubPosNegGT: Sub<10, -1> = 11;

// Neg, Pos can only be LT
const testSubNegPosLT: Sub<-1, 10> = -11;

const testSubNegNegLT: Sub<-10, -1> = -9;
const testSubNegNegGT: Sub<-1, -10> = 9;
const testSubNegNegEq: Sub<-10, -10> = 0;

// We don't have to do any GTE checking even when delegating to
// our Sub type since that type already handles those cases.
type Add<A extends number, B extends number> =
  IsNegative<A> extends true
    ? IsNegative<B> extends true
      ? AddUnchecked<Negate<A>, Negate<B>> extends number
        ? Negate<AddUnchecked<Negate<A>, Negate<B>>>
        : never
      : Sub<Negate<A>, B> extends number
        ? Negate<Sub<Negate<A>, B>>
        : never
    : IsNegative<B> extends true
      ? Sub<A, Negate<B>>
      : AddUnchecked<A, B>;

const testAddPosPos: Add<1, 10> = 11;
const testAddPosNeg: Add<1, -10> = -9;
const testAddNegPos: Add<-10, 1> = -9;
const testAddNegNeg: Add<-10, -1> = -11;
