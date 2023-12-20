
function splitParams(paramString: string, backfillTypes = true) {
  let depth = 0;
  let currentParam = '';
  const params: Array<string> = [];

  for (let char of paramString) {
    if (char === '(') {
      depth++;
    } else if (char === ')') {
      depth--;
    }

    if (char === ',' && depth === 0) {
      params.push(currentParam.trim());
      currentParam = '';
    } else {
      currentParam += char;
    }
  }

  if (currentParam.trim() !== '') {
    params.push(currentParam.trim());
  }

  const typedParams: Array<Param> = [];

  // walk backwards so we can backfill types
  let prevType = '';
  for (let idx = params.length - 1; idx >= 0; idx--) {
    const param = params[idx] as string;
    let name: string | undefined = param.split(' ')[0]
    let type = param.split(' ').slice(1).join(' ');

    if (!type && backfillTypes) {
      type = prevType;
    }
    
    if (!type) {
      type = name;
      name = undefined;
    }
      
    // remember type so we can backfill empty types (e.g. `foo, bar, baz string`)
    prevType = type;

    const isVariadic = type.startsWith('...');
    const isPointer = type.startsWith('*');
    type = type.replace(/^\*+/, '').replace(/^\.\.\./, '');

    typedParams[idx] = {
      name,
      type,
      isVariadic,
      isPointer
    }
  }

  return typedParams;
}

export type Param = { name: string | undefined; type: string; isVariadic: boolean; isPointer: boolean };
export type Method = { name: string; params: Array<Param>; returns: Array<Param>; signature: string };
export type InterfaceMethod = { interface: string; package: string, signature: string } & Method;

export function parseSignature(signature: string): Method {
  let currentPart = '';
  let depth = 0;
  let partType = 'method'; // Start with method

  const result = {
    method: '',
    params: '',
    returnTypes: ''
  };

  for (let char of signature) {
    if (char === '(') {
      depth++;
      if (depth === 1) {
        if (partType === 'method') {
          result[partType] = currentPart.trim();
          currentPart = '';
          partType = 'params';
        }
        continue;
      }
    } else if (char === ')') {
      depth--;
      if (depth === 0) {
        if (partType === 'params') {
          result[partType] = currentPart.trim();
          currentPart = '';
          partType = 'returnTypes';
        }
        continue;
      }
    }
    currentPart += char;
  }

  if (partType === 'returnTypes' && currentPart.trim() !== '') {
    result.returnTypes = currentPart.trim();
  }

  return {
    signature,
    name: result.method,
    params: splitParams(result.params),
    returns: splitParams(result.returnTypes, false),
  };
}