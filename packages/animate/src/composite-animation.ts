import { AnimatableAttributeHelper, Keyframe } from "./animatable-attribute";

/**
 * Linear easing function (no easing).
 *
 * @param percentage - Animation progress (0.0 to 1.0)
 * @returns Same as input (linear progression)
 *
 * @category Easing
 */
export const linear = (percentage: number) => {
    return percentage;
}

/**
 * Core interface for all animators in the animation system.
 *
 * @remarks
 * The Animator interface defines the contract for both individual animations ({@link Animation})
 * and composite animations ({@link CompositeAnimation}). All animators support:
 * - Lifecycle control (start, stop, pause, resume)
 * - Duration management with delays and drag time
 * - Looping with optional max loop count
 * - Parent-child relationships for composition
 * - Event callbacks for start and end
 *
 * @category Core
 */
export interface Animator{
    loops: boolean;
    duration: number;
    delay: number;
    drag: number;
    nonCascadingDuration(newDuration: number): void;
    start(): void;
    stop(): void;
    pause(): void;
    resume(): void;
    animate(deltaTime: number): void;
    setUp(): void;
    resetAnimationState(): void;
    tearDown(): void;
    setParent(parent: AnimatorContainer): void;
    detachParent(): void;
    toggleReverse(reverse: boolean): void;
    onEnd(callback: Function): UnSubscribe;
    onStart(callback: Function): UnSubscribe;
    clearOnStart(): void;
    clearOnEnd(): void;
    maxLoopCount: number | undefined;
    playing: boolean;
}

/**
 * Function type for unsubscribing from animation events.
 *
 * @category Core
 */
export type UnSubscribe = () => void;

/**
 * Interface for containers that hold and manage child animators.
 *
 * @remarks
 * Implemented by {@link CompositeAnimation} to manage hierarchical animation structures.
 * Handles duration updates and prevents cyclic dependencies.
 *
 * @category Core
 */
export interface AnimatorContainer {
    updateDuration(): void;
    checkCyclicChildren(): boolean;
    containsAnimation(animationInInterest: Animator): boolean;
}

/**
 * Container for sequencing and composing multiple animations.
 *
 * @remarks
 * CompositeAnimation allows you to orchestrate complex animation sequences by:
 * - **Sequencing**: Add animations to play one after another
 * - **Overlapping**: Start animations before previous ones complete
 * - **Synchronizing**: Play multiple animations simultaneously
 * - **Nesting**: Compose animations contain other composite animations
 *
 * ## Key Features
 *
 * - Add animations at specific time offsets
 * - Position animations relative to other animations (`addAnimationAfter`, `addAnimationBefore`)
 * - Automatic duration calculation based on child animations
 * - Hierarchical composition for complex sequences
 * - Prevent cyclic animation dependencies
 *
 * @example
 * Basic sequence
 * ```typescript
 * const sequence = new CompositeAnimation();
 *
 * // Add first animation at start (time 0)
 * sequence.addAnimation('fadeIn', fadeAnimation, 0);
 *
 * // Add second animation after first completes
 * sequence.addAnimationAfter('slideIn', slideAnimation, 'fadeIn');
 *
 * // Add third animation to overlap with second (100ms after second starts)
 * sequence.addAnimationAdmist('scaleUp', scaleAnimation, 'slideIn', 100);
 *
 * sequence.start();
 * ```
 *
 * @category Core
 */
export class CompositeAnimation implements Animator, AnimatorContainer{

    private animations: Map<string, {animator: Animator, startTime?: number}>;
    private localTime: number;
    private _duration: number;
    private onGoing: boolean;
    private loop: boolean;
    private playedTime: number;
    private setUpFn: Function;
    private tearDownFn: Function;
    private _dragTime: number;
    private _delayTime: number;
    private parent: AnimatorContainer | undefined;
    private _maxLoopCount: number | undefined;

    private endCallbacks: Function[] = [];
    private startCallbacks: Function[] = [];

    private reverse: boolean;

    constructor(animations: Map<string, {animator: Animator, startTime?: number}> = new Map(), loop: boolean = false, parent: AnimatorContainer | undefined = undefined, setupFn: Function = ()=>{}, tearDownFn: Function = ()=>{}){
        this.animations = animations;
        this._duration = 0;
        this.calculateDuration();
        this.localTime = -1;
        this.onGoing = false;
        this.loop = loop;
        this.setUpFn = setupFn;
        this.tearDownFn = tearDownFn;
        this._delayTime = 0;
        this._dragTime = 0;
        this.parent = parent;
        this.animations.forEach((animation) => {
            animation.animator.setParent(this);
        });
        this.reverse = false;
        this.playedTime = 0;
    }

    toggleReverse(reverse: boolean){
        if(this.reverse == reverse){
            return;
        }
        this.reverse = reverse;
        this.animations.forEach((animation) => {
            animation.animator.toggleReverse(reverse);
        });
    }
    
    setParent(parent: AnimatorContainer){
        this.parent = parent;
    }

    detachParent(){
        this.parent = undefined;
    }

    animate(deltaTime: number): void {
        if(!this.onGoing || this.localTime > this._duration + this._delayTime + this._dragTime || this.localTime < 0 || this.animations.size == 0){
            return;
        }
        this.localTime += deltaTime;
        if (this.localTime - deltaTime <= 0 && deltaTime > 0){
            // console.log("composite animation start");
            this.startCallbacks.forEach((callback) => {
                queueMicrotask(()=>{callback()});
            });
        }
        this.animateChildren(deltaTime);
        this.checkTerminalAndLoop();
    }

    checkTerminalAndLoop(){
        if(this.localTime >= this._duration + this._delayTime + this._dragTime){
            // console.log("composite animation end");
            this.playedTime += 1;
            this.endCallbacks.forEach((callback) => {
                queueMicrotask(()=>{callback()});
            });
            if(!this.loops || (this.maxLoopCount != undefined && this.playedTime >= this.maxLoopCount)){
                // this.onGoing = false;
                this.stop();
            } else {
                // if loop is true and current loop is not the last loop, then prepare to start the animations again
                // this.onGoing = true;
                // this.localTime = 0;
                // this.animations.forEach((animation) => {
                //     if(animation.animator.loops){
                //         animation.animator.startAnimation();
                //     }
                // });
                this.start();
            }
        }
    }

    animateChildren(deltaTime: number){
        const prevLocalTime = this.localTime - deltaTime;
        if(this.localTime < this._delayTime){
            return;
        }
        this.animations.forEach((animation, name: string) => {
            if(animation.startTime == undefined){
                animation.startTime = 0;
            }
            if(!this.childShouldAnimate(animation, prevLocalTime)){
                this.wrapUpAnimator({animator: animation.animator, startTime: animation.startTime, name: name}, prevLocalTime);
                return;
            }
            if(prevLocalTime - this._delayTime < animation.startTime){
                animation.animator.animate(this.localTime - this._delayTime - animation.startTime);
            } else {
                animation.animator.animate(deltaTime);
            }
        });
    }

    childShouldAnimate(animation: {animator: Animator, startTime?: number}, prevLocalTime: number): boolean{
        if(animation.startTime == undefined){
            animation.startTime = 0;
        }
        if(this.localTime - this._delayTime >= animation.startTime && this.localTime - this._delayTime <= animation.startTime + animation.animator.duration){
            return true;
        }
        return false;
    }

    wrapUpAnimator(animation: {animator: Animator, startTime?: number, name: string}, prevLocalTime: number){
        if(animation.startTime == undefined){
            animation.startTime = 0;
        }
        if(this.localTime - this._delayTime > animation.startTime + animation.animator.duration && prevLocalTime - this._delayTime < animation.startTime + animation.animator.duration){
            // console.log("wrap up", animation.name);
            // console.log("time remaining", animation.startTime + animation.animator.duration - (prevLocalTime - this._delayTime));
            
            animation.animator.animate(animation.startTime + animation.animator.duration - (prevLocalTime - this._delayTime));
        }
    }

    pause(): void {
        this.onGoing = false;
        this.animations.forEach((animation) => {
            animation.animator.pause();
        });
    }

    resume(): void {
        this.onGoing = true;
        this.animations.forEach((animation) => {
            animation.animator.resume();
        });
    }

    start(): void {
        this.onGoing = true;
        this.setUp();
        this.localTime = 0;
        this.animations.forEach((animation) => {
            animation.animator.start();
        });
    }

    stop(): void {
        this.onGoing = false;
        this.playedTime = 0;
        this.localTime = this._duration + 0.1;
        this.animations.forEach((animation) => {
            animation.animator.stop();
        });
        this.tearDown();
    }

    get duration(): number {
        return this._duration + this._delayTime + this._dragTime;
    }

    set duration(duration: number) {
        if(duration < 0){
            return;
        }
        const originalDuration = this._duration + this._delayTime + this._dragTime;
        const scale = duration / originalDuration;
        const newDelayTime = this._delayTime * scale;
        const newDragTime = this._dragTime * scale;
        this._delayTime = newDelayTime;
        this._dragTime = newDragTime;
        this.animations.forEach((animation)=>{
            if(animation.startTime == undefined){
                animation.startTime = 0;
            }
            animation.startTime *= scale;
            const newDuration = animation.animator.duration * scale;
            animation.animator.nonCascadingDuration(newDuration);
        });
        this.calculateDuration();
        if(this.parent != undefined){
            this.parent.updateDuration();
        }
    }

    nonCascadingDuration(newDuration: number): void {
        if(newDuration < 0){
            return;
        }
        const originalDuration = this._duration + this._delayTime + this._dragTime;
        const scale = newDuration / originalDuration;
        const newDelayTime = this._delayTime * scale;
        const newDragTime = this._dragTime * scale;
        this._delayTime = newDelayTime;
        this._dragTime = newDragTime;
        this.animations.forEach((animation)=>{
            if(animation.startTime == undefined){
                animation.startTime = 0;
            }
            animation.startTime *= scale;
            const newDuration = animation.animator.duration * scale;
            animation.animator.nonCascadingDuration(newDuration);
        });
        this.calculateDuration();
    }

    resetAnimationState(): void {
        this.onGoing = false;
        this.animations.forEach((animation) => {
            animation.animator.resetAnimationState();
        });
    }

    getTrueDuration(): number{
        return this._duration;
    }

    setUp(): void {
        this.setUpFn();
        this.animations.forEach((animation) => {
            animation.animator.setUp();
        });
    }

    tearDown(): void {
        this.tearDownFn();
        this.animations.forEach((animation) => {
            animation.animator.tearDown();
        }); 
    }

    addAnimation(name: string, animation: Animator, startTime: number = 0, endCallback: Function = ()=>{}){
        if(this.animations.has(name)){
            return;
        }
        if(this.parent !== undefined && this.parent.containsAnimation(animation)){
            return;
        }
        this.animations.set(name, {animator: animation, startTime: startTime});
        animation.setParent(this);
        if(this.localTime > startTime){
            animation.animate(this.localTime - startTime);
        }
        const endTime = startTime + animation.duration;
        this._duration = Math.max(this._duration, endTime);
        if(this.parent != undefined){
            this.parent.updateDuration();
        }
    }

    addAnimationAfter(name: string, animation: Animator, afterName: string, delay: number = 0){
        let afterAnimation = this.animations.get(afterName);
        if(afterAnimation == undefined){
            return;
        }
        if(afterAnimation.startTime == undefined){
            afterAnimation.startTime = 0;
        }
        let startTime = afterAnimation.startTime + afterAnimation.animator.duration;
        startTime += delay;
        this.addAnimation(name, animation, startTime);
        this.calculateDuration();
        if(this.parent != undefined){
            this.parent.updateDuration();
        }
    }

    addAnimationAdmist(name: string, animation: Animator, admistName: string, delay: number){
        let admistAnimation = this.animations.get(admistName);
        if(admistAnimation == undefined){
            return;
        }
        if(admistAnimation.startTime == undefined){
            admistAnimation.startTime = 0;
        }
        let startTime = admistAnimation.startTime + delay;
        this.addAnimation(name, animation, startTime);
        this.calculateDuration();
        if(this.parent != undefined){
            this.parent.updateDuration();
        }
    }

    addAnimationBefore(name: string, animation: Animator, beforeName: string, aheadTime: number = 0){
        let beforeAnimation = this.animations.get(beforeName);
        if(beforeAnimation == undefined){
            return;
        }
        if(beforeAnimation.startTime == undefined){
            beforeAnimation.startTime = 0;
        }
        let startTime = beforeAnimation.startTime;
        startTime -= aheadTime;
        this.addAnimation(name, animation, startTime);
        if (startTime < 0){
            const pushOver = 0 - startTime;
            this.animations.forEach((animation) => {
                if(animation.startTime == undefined){
                    animation.startTime = 0;
                }
                animation.startTime += pushOver;
            });
        }
        this.calculateDuration();
        if(this.parent != undefined){
            this.parent.updateDuration();
        }
    }

    removeAnimation(name: string){
        let animation = this.animations.get(name);
        let deleted = this.animations.delete(name);
        if(deleted){
            if(animation != undefined){
                animation.animator.detachParent();
            }
            this.calculateDuration();
            if(this.parent != undefined){
                this.parent.updateDuration();
            }
        }
    }

    set delay(delayTime: number){
        this._delayTime = delayTime;
        if(this.parent != undefined){
            this.parent.updateDuration();
        }
    }

    get delay(): number{
        return this._delayTime;
    }

    set drag(dragTime: number){
        this._dragTime = dragTime;
        if(this.parent != undefined){
            this.parent.updateDuration();
        }
    }

    get drag(): number {
        return this._dragTime;
    }

    removeDelay(){
        this._delayTime = 0;
        if(this.parent != undefined){
            this.parent.updateDuration();
        }
    }

    removeDrag(){
        this._dragTime = 0;
        if(this.parent != undefined){
            this.parent.updateDuration();
        }
    }

    updateDuration(): void {
        if(this.checkCyclicChildren()){
            return;
        }
        this.calculateDuration();
        if(this.parent != undefined){
            this.parent.updateDuration();
        }
    }

    calculateDuration(){
        this._duration = 0;
        this.animations.forEach((animation)=>{
            if(animation.startTime == undefined){
                animation.startTime = 0;
            }
            const endTime = animation.startTime + animation.animator.duration;
            this._duration = Math.max(this._duration, endTime);
        });
    }
    
    get loops(): boolean {
        return this.loop;
    }

    set loops(loop: boolean) {
        this.loop = loop;
    }

    checkCyclicChildren(): boolean {
        const allChildren: Animator[] = [];
        allChildren.push(this);
        const visited = new Set<Animator>();
        while(allChildren.length > 0){
            const current = allChildren.pop();
            if(current == undefined){
                continue;
            }
            if(visited.has(current)){
                return true;
            }
            visited.add(current);
            if(current instanceof CompositeAnimation){
                current.animations.forEach((animation) => {
                    allChildren.push(animation.animator);
                });
            }
        }
        return false;
    }

    forceToggleLoop(loop: boolean){
        this.loop = true;
        this.animations.forEach((animation) => {
            animation.animator.loops = true;
        });
    }

    containsAnimation(animationInInterest: Animator): boolean {
        if(this.parent !== undefined){
            return this.parent.containsAnimation(animationInInterest);
        }
        const allChildren: Animator[] = [];
        allChildren.push(this);
        const visited = new Set<Animator>();
        while(allChildren.length > 0){
            const current = allChildren.pop();
            if(current == undefined){
                continue;
            }
            if(current == animationInInterest){
                return true;
            }
            if(visited.has(current)){
                continue;
            }
            visited.add(current);
            if(current instanceof CompositeAnimation){
                current.animations.forEach((animation) => {
                    allChildren.push(animation.animator);
                });
            }
        }
        return false;
    }

    onEnd(callback: Function): UnSubscribe{
        this.endCallbacks.push(callback);
        return ()=>{
            this.endCallbacks = this.endCallbacks.filter((cb) => cb != callback);
        }
    }

    onStart(callback: Function): UnSubscribe{
        this.startCallbacks.push(callback);
        return ()=>{
            this.startCallbacks = this.startCallbacks.filter((cb) => cb != callback);
        }
    }

    clearOnEnd(): void {
        this.endCallbacks = [];
    }

    clearOnStart(): void {
        this.startCallbacks = [];
    }

    get playing(): boolean {
        return this.onGoing;
    }

    get maxLoopCount(): number | undefined {
        return this._maxLoopCount;
    }

    set maxLoopCount(maxLoopCount: number | undefined) {
        this._maxLoopCount = maxLoopCount;
    }
}

/**
 * Keyframe-based animation for a single value.
 *
 * @remarks
 * The Animation class interpolates a value through a series of keyframes over time.
 * It handles:
 * - Keyframe interpolation with binary search for efficiency
 * - Easing functions for smooth motion curves
 * - Reverse playback
 * - Looping with optional max loop count
 * - Delays before start and drag time after completion
 * - Lifecycle callbacks
 *
 * ## How It Works
 *
 * 1. Define keyframes at percentages (0.0 to 1.0) along the timeline
 * 2. Provide a callback to apply the animated value
 * 3. Provide an interpolation helper for the value type
 * 4. Call `animate(deltaTime)` each frame to progress the animation
 *
 * @typeParam T - The type of value being animated
 *
 * @example
 * Animating a number with easing
 * ```typescript
 * let opacity = 0;
 *
 * const fadeIn = new Animation(
 *   [
 *     { percentage: 0, value: 0 },
 *     { percentage: 1, value: 1, easingFn: (t) => t * t } // Ease-in
 *   ],
 *   (value) => { opacity = value; },
 *   numberHelperFunctions,
 *   1000 // 1 second duration
 * );
 *
 * fadeIn.start();
 *
 * // In animation loop
 * function loop(deltaTime: number) {
 *   fadeIn.animate(deltaTime);
 *   element.style.opacity = opacity;
 * }
 * ```
 *
 * @category Core
 */
export class Animation<T> implements Animator{

    private localTime: number; // local time starting from 0 up til duration
    private _duration: number;
    private keyframes: Keyframe<T>[];
    private animatableAttributeHelper: AnimatableAttributeHelper<T>;
    private applyAnimationValue: (value: T) => void;
    private easeFn: (percentage: number) => number;
    private onGoing: boolean;
    private currentKeyframeIndex: number;
    private loop: boolean;
    private playedTime: number;
    private setUpFn: Function;
    private tearDownFn: Function;
    private parent: AnimatorContainer | undefined;
    private delayTime: number = 0;
    private dragTime: number = 0;

    private reverse: boolean = false;
    private endCallbacks: Function[] = [];
    private startCallbacks: Function[] = [];
    private startAfterDelayCallbacks: Function[] = [];

    private zeroPercentageValue: T;
    private _maxLoopCount: number | undefined;
    private _fillMode: 'none' | 'forwards' | 'backwards' | 'both' = 'none';

    constructor(keyFrames: Keyframe<T>[], applyAnimationValue: (value: T) => void, animatableAttributeHelper: AnimatableAttributeHelper<T>, duration: number = 1000, loop: boolean = false, parent: AnimatorContainer | undefined = undefined, setUpFn: Function = ()=>{}, tearDownFn: Function = ()=>{}, easeFn: (percentage: number) => number = linear){
        this._duration = duration;
        this.keyframes = keyFrames;
        this.animatableAttributeHelper = animatableAttributeHelper;
        this.applyAnimationValue = applyAnimationValue;
        this.easeFn = easeFn;
        this.onGoing = false;
        this.localTime = duration + 0.1;
        this.currentKeyframeIndex = 0;
        this.loop = loop;
        this.setUpFn = setUpFn;
        this.tearDownFn = tearDownFn;
        this.parent = parent;
        this.playedTime = 0;
        this.zeroPercentageValue = this.findValue(0, keyFrames, animatableAttributeHelper);
    }

    toggleReverse(reverse: boolean): void{
        this.reverse = reverse;
    }

    start(): void{
        this.localTime = 0;
        this.currentKeyframeIndex = 0;
        this.onGoing = true;
        // this.applyAnimationValue(this.zeroPercentageValue);
        this.setUp();
    }

    stop(): void{
        this.onGoing = false;
        this.localTime = this._duration + this.dragTime + this.delayTime + 0.1;
        this.playedTime = 0;
        this.tearDown();
    }

    pause(): void{
        this.onGoing = false;
    }

    resume(){
        this.onGoing = true;
    }

    get playing(): boolean {
        return this.onGoing;
    }

    animate(deltaTime: number){
        if(this.onGoing != true || this.localTime < 0) {
            return;
        }
        if(deltaTime == 0){
            return;
        }
        this.localTime += deltaTime;
        // console.log("--------------------");
        // console.log("local time", this.localTime);
        // console.log("delta time", deltaTime);
        if(this.localTime - deltaTime <= 0 && deltaTime > 0){
            // console.log("--------------------");
            // console.log("current localtime", this.localTime);
            // console.log("current delta time", deltaTime);
            // console.log("previous local time", this.localTime - deltaTime);
            // console.log("animation start");
            // console.log(`the animation has been played ${this.playedTime} times`);
            // console.log(`the animation is now playing for the ${this.playedTime + 1} time`);
            this.startCallbacks.forEach((callback) => {
                queueMicrotask(()=>{callback()});
            });
        }
        if(this.localTime >= this.delayTime && (this.localTime <= this.delayTime + this._duration + this.dragTime || this.localTime - deltaTime <= this.delayTime + this._duration + this.dragTime)){
            // console.log("local time", this.localTime);
            // console.log("duration", this.duration);
            // console.log("local time would trigger end", this.localTime >= this._duration + this.delayTime + this.dragTime);
            // console.log("delta time", deltaTime);
            if(this.localTime - deltaTime <= this.delayTime && this.delayTime !== 0 && deltaTime > 0){
                this.startAfterDelayCallbacks.forEach((callback) => {
                    queueMicrotask(()=>{callback()});
                });
                this.applyAnimationValue(this.zeroPercentageValue);
            }
            let localTimePercentage = (this.localTime - this.delayTime) / (this._duration);
            let targetPercentage = this.easeFn(localTimePercentage);
            if (localTimePercentage > 1){
                targetPercentage = this.easeFn(1);
            }
            let value: T;
            // console.log("currentKeyframeIndex", this.currentKeyframeIndex, "length", this.keyFrames.length);
            if(this.currentKeyframeIndex < this.keyframes.length && this.currentKeyframeIndex >= 0 && (this.reverse ? 1 - this.keyframes[this.currentKeyframeIndex].percentage == targetPercentage : this.keyframes[this.currentKeyframeIndex].percentage == targetPercentage) ){
                value = this.keyframes[this.currentKeyframeIndex].value;
            } else {
                value = this.findValue(targetPercentage, this.keyframes, this.animatableAttributeHelper);
            }
            if(this.reverse){
                while(this.currentKeyframeIndex >= 0 && 1 - this.keyframes[this.currentKeyframeIndex].percentage <= targetPercentage){
                    this.currentKeyframeIndex -= 1;
                }
            } else {
                while(this.currentKeyframeIndex < this.keyframes.length && this.keyframes[this.currentKeyframeIndex].percentage <= targetPercentage){
                    this.currentKeyframeIndex += 1;
                }
            }
            this.applyAnimationValue(value);
            if(this.localTime >= this._duration + this.dragTime + this.delayTime){
                // console.log("animation should end");
                this.playedTime += 1;
                this.endCallbacks.forEach((callback) => {
                    queueMicrotask(()=>{callback()});
                });
                if(!this.loops || (this._maxLoopCount != undefined && this.playedTime >= (this.maxLoopCount ?? 0))){
                    // this.onGoing = false;
                    // console.log("animation should stop after ", this.playedTime, " loops");
                    this.stop();
                } else {
                    // console.log("animation should restart");
                    this.onGoing = true;
                    this.localTime = 0;
                    this.currentKeyframeIndex = 0;
                    this.start();
                }
            }
            // if((this.localTime >= this._duration + this.delayTime + this.dragTime) && this.loop){
            //     // this.startAnimation();
            //     this.localTime = 0;
            //     this.onGoing = true;
            //     this.currentKeyframeIndex = 0;
            // }
        }
    }

    findValue(valuePercentage: number, keyframes: Keyframe<T>[], animatableAttributeHelper: AnimatableAttributeHelper<T>): T{
        if(valuePercentage > 1){
            if(this.reverse){
                return animatableAttributeHelper.lerp(valuePercentage, keyframes[1], keyframes[0]);
            }
            return animatableAttributeHelper.lerp(valuePercentage, keyframes[keyframes.length - 2], keyframes[keyframes.length - 1]);
        }
        if(valuePercentage < 0){
            if(this.reverse){
                return animatableAttributeHelper.lerp(valuePercentage, keyframes[keyframes.length - 2], keyframes[keyframes.length - 1]);
            }
            return animatableAttributeHelper.lerp(valuePercentage, keyframes[1], keyframes[0]);
        }
        let left = 0;
        let right = keyframes.length - 1;
        while (left <= right) {
            let mid = left + Math.floor((right - left) / 2);
            const midPercentage = this.reverse ? 1 - keyframes[mid].percentage : keyframes[mid].percentage;
            if(midPercentage == valuePercentage) {
                return keyframes[mid].value;
            } else if(midPercentage < valuePercentage){
                if(this.reverse){
                    right = mid - 1;
                } else {
                    left = mid + 1;
                }
            } else {
                if(this.reverse){
                    left = mid + 1;
                } else {
                    right = mid - 1;
                }
            }
        }
        if(left > keyframes.length - 1){
            // excceding the keyframes
            left = keyframes.length - 1;
        }
        const interpolateStartFrame = this.reverse ? {percentage: 1 - keyframes[left].percentage, value: keyframes[left].value} : keyframes[left - 1];
        const interplateEndFrame = this.reverse ? {percentage: 1 - keyframes[left - 1].percentage, value: keyframes[left - 1].value} : keyframes[left];
        // return animatableAttributeHelper.lerp(valuePercentage, keyframes[left - 1], keyframes[left]);
        return animatableAttributeHelper.lerp(valuePercentage, interpolateStartFrame, interplateEndFrame);
    }

    setUp(): void {
        // this.applyAnimationValue(this.keyframes[0].value);
        this.setUpFn();
    }

    tearDown(): void {
        this.tearDownFn(); 
    }

    get loops(): boolean {
        return this.loop;
    }

    set loops(loop: boolean) {
        this.loop = loop;
    }

    get duration(): number {
        return this._duration + this.delayTime + this.dragTime;
    }

    set duration(duration: number) {
        if(duration < 0){
            return;
        }
        const originalDuration = this._duration + this.delayTime + this.dragTime;
        const scale = duration / originalDuration;
        const newDelayTime = this.delayTime * scale;
        const newDragTime = this.dragTime * scale;
        this.delayTime = newDelayTime;
        this.dragTime = newDragTime;
        this._duration = this._duration * scale;
        if(this.parent != undefined){
            this.parent.updateDuration();
        }
    }

    nonCascadingDuration(newDuration: number): void {
        if(newDuration < 0){
            return;
        }
        const originalDuration = this._duration + this.delayTime + this.dragTime;
        const scale = newDuration / originalDuration;
        const newDelayTime = this.delayTime * scale;
        const newDragTime = this.dragTime * scale;
        this.delayTime = newDelayTime;
        this.dragTime = newDragTime;
        this._duration = newDuration;
    }

    resetAnimationState(): void {
        this.onGoing = false;
        this.applyAnimationValue(this.keyframes[0].value);
        this.currentKeyframeIndex = 0;
        this.setUp();
    }

    wrapUp(): void {
        this.onGoing = false;
        this.localTime = this._duration + this.dragTime + this.delayTime + 0.1;
        this.currentKeyframeIndex = 0;
    }

    get delay(): number {
        return this.delayTime;
    }

    set delay(delayTime: number){
        this.delayTime = delayTime;
        if(this.parent != undefined){
            this.parent.updateDuration();
        }
    }

    get drag(): number {
        return this.dragTime;
    }

    set drag(dragTime: number){
        this.dragTime = dragTime;
        if(this.parent != undefined){
            this.parent.updateDuration();
        }
    }

    get trueDuration(): number {
        return this._duration;
    }

    set trueDuration(duration: number){
        this._duration = duration;
        if(this.parent != undefined){
            this.parent.updateDuration();
        }
    }

    setParent(parent: AnimatorContainer){
        this.parent = parent;
    }

    detachParent(): void {
        this.parent = undefined;
    }

    set keyFrames(keyFrames: Keyframe<T>[]){
        this.keyframes = keyFrames;
        this.zeroPercentageValue = this.findValue(0, keyFrames, this.animatableAttributeHelper);
    }

    get keyFrames(): Keyframe<T>[]{
        return this.keyframes;
    }

    get easeFunction(): (percentage: number) => number {
        return this.easeFn;
    }

    set easeFunction(easeFn: (percentage: number) => number){
        this.easeFn = easeFn;
    }

    onEnd(callback: Function): UnSubscribe{
        this.endCallbacks.push(callback);
        return ()=>{
            this.endCallbacks = this.endCallbacks.filter((cb) => cb != callback);
        }
    }

    onStart(callback: Function): UnSubscribe{
        this.startCallbacks.push(callback);
        return ()=>{
            this.startCallbacks = this.startCallbacks.filter((cb) => cb != callback);
        }
    }

    onStartAfterDelay(callback: Function): UnSubscribe{
        this.startAfterDelayCallbacks.push(callback);
        return ()=>{
            this.startAfterDelayCallbacks = this.startAfterDelayCallbacks.filter((cb) => cb != callback);
        }
    }

    clearOnEnd(): void {
        this.endCallbacks = [];
    }

    clearOnStart(): void {
        this.startCallbacks = [];
    }

    get maxLoopCount(): number | undefined {
        return this._maxLoopCount;
    }

    set maxLoopCount(maxLoopCount: number | undefined) {
        this._maxLoopCount = maxLoopCount;
    }
}

export interface Keyframes<T> {
    keyframes: Keyframe<T>[];
    from(value: T): Keyframes<T>;
    to(value: T): Keyframes<T>;
    insertAt(percentage: number, value: T): void;
    clearFrames(): void;
}

export class KeyFramesContiner<T> {

    private _keyframes: Keyframe<T>[];

    constructor(){
        this._keyframes = [];
    }

    get keyframes(): Keyframe<T>[] {
        return this._keyframes;
    }

    from(value: T): Keyframes<T>{
        if(this._keyframes.length == 0){
            this._keyframes.push({percentage: 0, value: value});
        } else {
            if(this._keyframes[0].percentage == 0){
                this._keyframes[0].value = value;
            } else {
                this._keyframes.unshift({percentage: 0, value: value});
            }
        }
        return this;
    }

    to(value: T): Keyframes<T>{
        if(this._keyframes.length == 0){
            this._keyframes.push({percentage: 1, value: value});
        } else {
            if(this._keyframes[this._keyframes.length - 1].percentage == 1){
                this._keyframes[this._keyframes.length - 1].value = value;
            } else {
                this._keyframes.push({percentage: 1, value: value});
            }
        }
        return this;
    }

    insertAt(percentage: number, value: T): void{
        this._keyframes.push({percentage: percentage, value: value});
    }

    clearFrames(): void{
        this._keyframes = [];
    }
}
