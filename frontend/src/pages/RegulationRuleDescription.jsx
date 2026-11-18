import React from 'react';
import { describeRegulationRule } from './regulationRule';

function RuleNode({ node }) {
  return <>
    <span>{node.label}</span>
    {node.children && <ul className="mt-1.5 list-disc space-y-1 pl-5">
      {node.children.map((child, index) => <li key={index}>
        {index > 0 && <strong>{node.connector} </strong>}
        <RuleNode node={child} />
      </li>)}
    </ul>}
  </>;
}

export default function RegulationRuleDescription({ rule, catalog, coverageStatus }) {
  return <RuleNode node={describeRegulationRule(rule, catalog, coverageStatus)} />;
}
