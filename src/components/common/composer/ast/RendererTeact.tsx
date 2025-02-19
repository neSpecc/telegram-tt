import type { FC } from '../../../../lib/teact/teact';
import React, {
  memo,
  useEffect,
  useState,
} from '../../../../lib/teact/teact';

import type { Signal } from '../../../../util/signals';
import type { ASTRootNode } from './entities/ASTNode';

type OwnProps = {
  getAst: Signal<ASTRootNode | undefined>;
};

type StateProps = {

};

const RendererTeact: FC<OwnProps & StateProps> = ({
  getAst,
}) => {
  const [ast, setAst] = useState<ASTRootNode | undefined>(undefined);

  useEffect(() => {
    setAst(getAst());
  }, [getAst]);

  return (
    <div>
      TEACT RENDERER!
      {ast?.children.map((child) => (
        <div key={child.id}>
          {JSON.stringify(child)}
        </div>
      ))}
    </div>
  );
};

export default memo(RendererTeact);
