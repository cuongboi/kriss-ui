const keys = [
  "../components/ui/card-hover-effect.tsx",
  "../components/ui/card.tsx"
];
const modulePath = "./components/ui/card";
const match1 = keys.find(key => key.match(RegExp(modulePath)));
console.log(match1);
