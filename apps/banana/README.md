Banana 

A simulation of a railway system using bezier curves. 

> Banana is just a placeholder name for the project. It is not going to be the final name. The origin of the name is from one of the Taipei Metro lines. It's called the <ruby>板<rt>Ban</rt></ruby> <ruby>南<rt>Nan</rt></ruby> 線. (AKA the blue line) My wife and I refer to it as the banana line as a joke.

Currently, the goal of the project is to create something like the NIMBY rail with a top down 2D view. but with more track layout flexibility. The scheduling system would be more of a mix of the NIMBY rail and the A-Train. Also the ability to carry passengers and cargo for different industries like Transport Fever. 

It's still in the early stages of development.

It's inside the ue-too monorepo because it's dependent on many other packages in the monorepo. Once the features of the project stabilize, it will be moved to a separate repository.

To run the project first clone the monorepo. 

At the root of the monorepo run the following command to install the dependencies.

```bash
pnpm install
```

Then run the dev server.

```bash
pnpm dev:banana
```
Any issues or feedback, please let me know by creating an issue.
